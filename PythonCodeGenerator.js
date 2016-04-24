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
     * Generate python package (a directory with __init__.py file)
     * @param {type.Model} elem
     * @param {string} path
     * @param {Object} options
     * @return {$.Promise}
     */
    PythonCodeGenerator.prototype.generatePackage = function (elem, path, options) {
        var result = new $.Deferred(),
            self = this,
            fullPath,
            directory,
            file;
        
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
        return result.promise();
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

        // Package
        if (elem instanceof type.UMLPackage) {
            self.generatePackage(elem, path, options).then(result.resolve, result.reject);
        } else {
            // Others (Nothing generated.)
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
        var result = new $.Deferred();
        var pythonCodeGenerator = new PythonCodeGenerator(baseModel, basePath);
        return pythonCodeGenerator.generate(baseModel, basePath, options);
    }

    exports.generate = generate;

});
