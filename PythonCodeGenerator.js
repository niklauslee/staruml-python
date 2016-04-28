/*
 * Copyright (c) 2014 MKLab. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, regexp: true */
/*global define, $, _, window, app, type, document, java7 */

define(function (require, exports, module) {
    "use strict";

    var Repository     = app.getModule("core/Repository"),
        ProjectManager = app.getModule("engine/ProjectManager"),
        Engine         = app.getModule("engine/Engine"),
        FileSystem     = app.getModule("filesystem/FileSystem"),
        FileUtils      = app.getModule("file/FileUtils"),
        Async          = app.getModule("utils/Async"),
        UML            = app.getModule("uml/UML");

    var CodeGenUtils = require("CodeGenUtils");

    /**
     * Python Code Generator
     * @constructor
     *
     * @param {type.UMLPackage} baseModel
     * @param {string} basePath generated files and directories to be placed
     */
    function PythonCodeGenerator(baseModel, basePath) {
        /** @member {type.Model} */
        this.baseModel = baseModel;

        /** @member {string} */
        this.basePath = basePath;
    }

    /**
     * Return Indent String based on options
     * @param {Object} options
     * @return {string}
     */
    PythonCodeGenerator.prototype.getIndentString = function (options) {
        if (options.useTab) {
            return "\t";
        } else {
            var i, len, indent = [];
            for (i = 0, len = options.indentSpaces; i < len; i++) {
                indent.push(" ");
            }
            return indent.join("");
        }
    };

    /**
     * Collect inheritances (super classes or interfaces) of a given element
     * @param {type.Model} elem
     * @return {Array.<type.Model>}
     */
    PythonCodeGenerator.prototype.getInherits = function (elem) {
        var inherits = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel.source === elem && (rel instanceof type.UMLGeneralization || rel instanceof type.UMLInterfaceRealization));
        });
        return _.map(inherits, function (gen) { return gen.target; });
    };

    /**
     * Write Doc
     * @param {StringWriter} codeWriter
     * @param {string} text
     * @param {Object} options
     */
    PythonCodeGenerator.prototype.writeDoc = function (codeWriter, text, options) {
        var i, len, lines;
        if (options.docString && text.trim().length > 0) {
            lines = text.trim().split("\n");
            if (lines.length > 1) {
                codeWriter.writeLine('"""');
                for (i = 0, len = lines.length; i < len; i++) {
                    codeWriter.writeLine(lines[i]);
                }
                codeWriter.writeLine('"""');
            } else {
                codeWriter.writeLine('"""' + lines[0] + '"""');
            }
        }
    };
    
    /**
     * Write Variable
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PythonCodeGenerator.prototype.writeVariable = function (codeWriter, elem, options, isClassVar) {
        if (elem.name.length > 0) {
            var line;
            if (isClassVar) {
                line = elem.name;
            } else {
                line = "self." + elem.name;
            }
            if (elem.multiplicity && _.contains(["0..*", "1..*", "*"], elem.multiplicity.trim())) {
                line += " = []";
            } else if (elem.defaultValue && elem.defaultValue.length > 0) {
                line += " = " + elem.defaultValue;
            } else {
                line += " = None";
            }
            codeWriter.writeLine(line);
        }
    };

    /**
     * Write Constructor
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PythonCodeGenerator.prototype.writeConstructor = function (codeWriter, elem, options) {
        var self = this,
            hasBody = false;
        codeWriter.writeLine("def __init__(self):");
        codeWriter.indent();
        
        // from attributes
        if (elem.attributes.length > 0) {
            elem.attributes.forEach(function (attr) {
                if (attr.isStatic === false) {
                    self.writeVariable(codeWriter, attr, options, false);
                    hasBody = true;
                }
            });
        }
        
        // from associations
        var associations = Repository.getRelationshipsOf(elem, function (rel) {
            return (rel instanceof type.UMLAssociation);
        });
        for (var i = 0, len = associations.length; i < len; i++) {
            var asso = associations[i];
            if (asso.end1.reference === elem && asso.end2.navigable === true) {
                self.writeVariable(codeWriter, asso.end2, options);
                hasBody = true;
            }
            if (asso.end2.reference === elem && asso.end1.navigable === true) {
                self.writeVariable(codeWriter, asso.end1, options);
                hasBody = true;
            }
        }
        
        if (!hasBody) {
            codeWriter.writeLine("pass");
        }
        
        codeWriter.outdent();
        codeWriter.writeLine();
    };

    /**
     * Write Method
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     * @param {boolean} skipBody
     * @param {boolean} skipParams
     */
    PythonCodeGenerator.prototype.writeMethod = function (codeWriter, elem, options) {
        if (elem.name.length > 0) {
            // name
            var line = "def " + elem.name;
            
            // params
            var params = elem.getNonReturnParameters();
            var paramStr = _.map(params, function (p) { return p.name; }).join(", ");
            
            if (elem.isStatic) {
                codeWriter.writeLine("@classmethod");
                codeWriter.writeLine(line + "(cls, " + paramStr + "):");
            } else {
                codeWriter.writeLine(line + "(self, " + paramStr + "):");
            }
            codeWriter.indent();
            this.writeDoc(codeWriter, elem.documentation, options);
            codeWriter.writeLine("pass");
            codeWriter.outdent();
            codeWriter.writeLine();
        }
    };

    /**
     * Write Enum
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PythonCodeGenerator.prototype.writeEnum = function (codeWriter, elem, options) {
        var self = this,
            line = "";

        codeWriter.writeLine("from enum import Enum");
        codeWriter.writeLine();
        
        // Enum
        line = "class " + elem.name + "(Enum):";
        codeWriter.writeLine(line);
        codeWriter.indent();
        
        // Docstring
        this.writeDoc(codeWriter, elem.documentation, options);
        
        if (elem.literals.length === 0) {
            codeWriter.writeLine("pass");
        } else {
            for (var i = 0, len = elem.literals.length; i < len; i++) {
                codeWriter.writeLine(elem.literals[i].name + " = " + (i + 1));
            }
            
        }
        codeWriter.outdent();
        codeWriter.writeLine();
    };
    
    /**
     * Write Class
     * @param {StringWriter} codeWriter
     * @param {type.Model} elem
     * @param {Object} options
     */
    PythonCodeGenerator.prototype.writeClass = function (codeWriter, elem, options) {
        var self = this,
            line = "",
            _inherits = this.getInherits(elem);

        // Import
        if (_inherits.length > 0) {
            _inherits.forEach(function (e) {
                var _path = _.map(e.getPath(self.baseModel), function (item) { return item.name; }).join(".");
                codeWriter.writeLine("from " + _path + " import " + e.name);
            });
            codeWriter.writeLine();
        }
        
        // Class
        line = "class " + elem.name;

        // Inherits
        if (_inherits.length > 0) {
            line += "(" + _.map(_inherits, function (e) { return e.name; }).join(", ") + ")";
        }

        codeWriter.writeLine(line + ":");
        codeWriter.indent();
        
        // Docstring
        this.writeDoc(codeWriter, elem.documentation, options);
        
        if (elem.attributes.length === 0 && elem.operations.length === 0) {
            codeWriter.writeLine("pass");
        } else {
            // Class Variable
            var hasClassVar = false;
            elem.attributes.forEach(function (attr) {
                if (attr.isStatic) {
                    self.writeVariable(codeWriter, attr, options, true);
                    hasClassVar = true;
                }
            });
            if (hasClassVar) {
                codeWriter.writeLine();
            }
            
            // Constructor
            this.writeConstructor(codeWriter, elem, options);
            
            // Methods
            if (elem.operations.length > 0) {
                elem.operations.forEach(function (op) {
                     self.writeMethod(codeWriter, op, options);
                });
            }
        }
        codeWriter.outdent();
        codeWriter.writeLine();
    };

    /**
     * Generate codes from a given element
     * @param {type.Model} elem
     * @param {string} path
     * @param {Object} options
     * @return {$.Promise}
     */
    PythonCodeGenerator.prototype.generate = function (elem, path, options) {
        var result = new $.Deferred(),
            self = this,
            fullPath,
            directory,
            codeWriter,
            file;

        // Package (a directory with __init__.py)
        if (elem instanceof type.UMLPackage) {
            fullPath = path + "/" + elem.name;
            directory = FileSystem.getDirectoryForPath(fullPath);
            directory.create(function (err, stat) {
                if (!err) {
                    file = FileSystem.getFileForPath(fullPath + "/__init__.py");
                    FileUtils.writeText(file, "", true)
                        .done(function () {
                            Async.doSequentially(
                                elem.ownedElements,
                                function (child) {
                                    return self.generate(child, fullPath, options);
                                },
                                false
                            ).then(result.resolve, result.reject);
                        })
                        .fail(function (err) {
                            result.reject(err);
                        });
                } else {
                    result.reject(err);
                }
            });

        // Class
        } else if (elem instanceof type.UMLClass || elem instanceof type.UMLInterface) {
            fullPath = path + "/" + elem.name + ".py";
            codeWriter = new CodeGenUtils.CodeWriter(this.getIndentString(options));
            codeWriter.writeLine(options.installPath);
            codeWriter.writeLine("#-*- coding: utf-8 -*-");
            codeWriter.writeLine();
            this.writeClass(codeWriter, elem, options);
            file = FileSystem.getFileForPath(fullPath);
            FileUtils.writeText(file, codeWriter.getData(), true).then(result.resolve, result.reject);

        // Enum
        } else if (elem instanceof type.UMLEnumeration) {
            fullPath = path + "/" + elem.name + ".py";
            codeWriter = new CodeGenUtils.CodeWriter(this.getIndentString(options));
            codeWriter.writeLine(options.installPath);
            codeWriter.writeLine("#-*- coding: utf-8 -*-");
            codeWriter.writeLine();
            this.writeEnum(codeWriter, elem, options);
            file = FileSystem.getFileForPath(fullPath);
            FileUtils.writeText(file, codeWriter.getData(), true).then(result.resolve, result.reject);
            
        // Others (Nothing generated.)
        } else {
            result.resolve();
        }
        return result.promise();
    };


    /**
     * Generate
     * @param {type.Model} baseModel
     * @param {string} basePath
     * @param {Object} options
     */
    function generate(baseModel, basePath, options) {
        var result = new $.Deferred(),
            directory,
            fullPath;
        var pythonCodeGenerator = new PythonCodeGenerator(baseModel, basePath);        
        fullPath = basePath + "/" + baseModel.name;
        directory = FileSystem.getDirectoryForPath(fullPath);
        directory.create(function (err, stat) {
            if (!err) {
                Async.doSequentially(
                    baseModel.ownedElements,
                    function (child) {
                        return pythonCodeGenerator.generate(child, fullPath, options);
                    },
                    false
                ).then(result.resolve, result.reject);
            } else {
                result.reject(err);
            }
        });
        return result.promise();
    }

    exports.generate = generate;

});
