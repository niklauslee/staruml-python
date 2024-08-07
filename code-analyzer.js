/*
 * Copyright (c) 2014-2018 MKLab. All rights reserved.
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
 */

const {
  PyObject,
  PyClass,
  PyPackage,
  PyFunction,
  PyModule,
  PyParameter,
  PyProperty,
  isPythonNamespace,
  isPythonPackage,
} = require("./python-objects");

/**
 * Python Code Analyzer
 */
class PythonCodeAnalyzer {
  /**
   * @constructor
   * @param {Object} options
   */
  constructor(options) {
    /** @member {type.UMLModel} */
    var project = app.repository.select("@Project")[0];
    this._root = app.factory.createModel({
      id: "UMLModel",
      parent: project,
      modelInitializer: function (model) {
        model.name = "PythonReverse";
      },
    });

    this._options = options;
    this._classes = [];
  }

  analyze(pth) {
    // Make sure the path is a Python package or namespace
    console.log(pth);

    if (isPythonPackage(pth) || isPythonNamespace(pth)) {
      var pyPackage = new PyPackage(pth, this._options);
      console.log(pyPackage);
      this.translatePyPackage(this._root, pyPackage);
    }

    // Load To Project
    var writer = new app.repository.Writer();
    writer.writeObj("data", this._root);
    var json = writer.current.data;
    app.project.importFromJson(app.project.getProject(), json);

    // Generate Diagrams
    this.generateDiagrams();
    console.log("[Python] done.");
  }

  /**
   * Generate Diagrams (Type Hierarchy, Package Structure, Package Overview)
   */
  generateDiagrams() {
    var baseModel = app.repository.get(this._root._id);
    if (this._options.packageStructure) {
      app.commands.execute(
        "diagram-generator:package-structure",
        baseModel,
        true,
      );
    }
    if (this._options.typeHierarchy) {
      app.commands.execute("diagram-generator:type-hierarchy", baseModel, true);
    }
    if (this._options.packageOverview) {
      baseModel.traverse((elem) => {
        if (elem instanceof type.UMLPackage) {
          app.commands.execute("diagram-generator:overview", elem, true);
        }
      });
    }
  }

  /**
   * Translate Python package.
   * @param {type.Model} namespace
   * @param {PyPackage} pyPackage
   */
  translatePyPackage(namespace, pyPackage) {
    var _package = app.factory.createModel({
      id: "UMLPackage",
      parent: namespace,
      modelInitializer: function (model) {
        model.name = pyPackage.name;
      },
    });

    pyPackage.modules.forEach((module) => {
      this.translatePyModule(_package, module);
    });
    pyPackage.packages.forEach((pkg) => {
      this.translatePyPackage(_package, pkg);
    });
  }

  /**
   * Translate Python module.
   * @param {type.Model} namespace
   * @param {PyModule} pyModule
   */
  translatePyModule(namespace, pyModule) {
    pyModule.classes.forEach((cls) => {
      this.translatePyClass(namespace, cls);
    });
  }

  /**
   * Translate Python class.
   * @param {type.Model} namespace
   * @param {PyClass} pyClass
   */
  translatePyClass(namespace, pyClass) {
    var _class = this._classes.find((value) => {
      return value.name == pyClass.getNameWithoutVisibility();
    });

    // If before the class was created earlier as a temporary parent - update it
    if (_class) {
      _class.parent = namespace;
      _class.name = pyClass.getNameWithoutVisibility();
      _class.visibility = pyClass.getVisibility();
    } else {
      // else - create
      _class = app.factory.createModel({
        id: "UMLClass",
        parent: namespace,
        modelInitializer: function (model) {
          model.name = pyClass.getNameWithoutVisibility();
          model.visibility = pyClass.getVisibility();
        },
      });
      this._classes.push(_class);
    }

    // Create Generalizations
    pyClass.bases.forEach((base) => {
      var baseClassName = PyObject.prototype.getNameWithoutVisibility(base);

      var baseClass = this._classes.find((value) => {
        return value.name == baseClassName;
      });

      if (!baseClass) {
        // create temp base class
        baseClass = app.factory.createModel({
          id: "UMLClass",
          parent: namespace,
          modelInitializer: function (model) {
            model.name = baseClassName;
            model.documentation = "Class not found";
          },
        });
        this._classes.push(baseClass);
      }

      var generalization = new type.UMLGeneralization();
      generalization._parent = _class;
      generalization.source = _class;
      generalization.target = baseClass;
      _class.ownedElements.push(generalization);
    });

    // Translate Members
    pyClass.methods.forEach((method) => {
      this.translateMethod(_class, method);
    });

    pyClass.properties.forEach((property) => {
      this.translateClassProperty(_class, property);
    });
  }

  /**
   * Translate Python Class property.
   * @param {type.Model} namespace
   * @param {PyProperty} pyProperty
   */
  translateClassProperty(namespace, pyProperty) {
    // Create Attribute
    app.factory.createModel({
      id: "UMLAttribute",
      parent: namespace,
      field: "attributes",
      modelInitializer: function (attribute) {
        attribute.name = pyProperty.getNameWithoutVisibility();
        attribute.visibility = pyProperty.getVisibility();
        if (pyProperty.default) attribute.defaultValue = pyProperty.default;
        if (pyProperty.type) attribute.type = pyProperty.type;
        attribute.isStatic = pyProperty.isStatic;
      },
    });
  }

  /**
   * Translate Python function
   * @param {type.Model} namespace
   * @param {PyFunction} pyFunction
   */
  translateMethod(namespace, pyFunction) {
    if (
      this._options.skipMagicMethods &&
      pyFunction.isMagic &&
      !pyFunction.isConstructor
    )
      return;

    var _operation = app.factory.createModel({
      id: "UMLOperation",
      parent: namespace,
      field: "operations",
      modelInitializer: function (operation) {
        operation.name = pyFunction.getNameWithoutVisibility();

        // Modifiers
        operation.visibility = pyFunction.getVisibility();
        operation.stereotype = pyFunction.stereotype;
        operation.isStatic = pyFunction.isStatic;
      },
    });

    // Return Type
    if (pyFunction.return) {
      app.factory.createModel({
        id: "UMLParameter",
        parent: _operation,
        field: "parameters",
        modelInitializer: function (parameter) {
          parameter.name = "return";
          parameter.type = pyFunction.return;
          parameter.direction = type.UMLParameter.DK_RETURN;
        },
      });
    }

    // Parameters
    pyFunction.parameters.forEach((parameter) => {
      this.translateParameter(_operation, parameter);
    });
  }

  /**
   * Translate Function Parameters
   * @param {type.Model} namespace
   * @param {PyParameter} pyParameter
   */
  translateParameter(namespace, pyParameter) {
    if (this._options.skipSelfParam && pyParameter.name == "self") return;

    app.factory.createModel({
      id: "UMLParameter",
      parent: namespace,
      field: "parameters",
      modelInitializer: function (parameter) {
        parameter.name = pyParameter.name;
        parameter.type = pyParameter.type;
        if (pyParameter.default) parameter.defaultValue = pyParameter.default;
      },
    });
  }
}

exports.PythonCodeAnalyzer = PythonCodeAnalyzer;
