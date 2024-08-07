const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

class PyObject {
  constructor(ctx) {
    this._ctx = ctx;
    this.name = this._getName();
  }

  _getName() {
    return this._ctx.name;
  }

  /**
   * Return visiblity from node name
   *
   * @return {string} Visibility constants for UML Elements
   */
  getVisibility() {
    if (this.name.startsWith("__")) {
      return type.UMLModelElement.VK_PRIVATE;
    } else if (this.name.startsWith("_")) {
      return type.UMLModelElement.VK_PROTECTED;
    }

    return type.UMLModelElement.VK_PUBLIC;
  }

  /**
   * Return name without visibility from object node
   *
   * @return {string} Object name
   */
  getNameWithoutVisibility(name = this.name) {
    if (name.startsWith("__") && name.endsWith("__")) {
      return name;
    } else if (name.startsWith("__")) {
      name = name.substring(2);
    } else if (name.startsWith("_")) {
      name = name.substring(1);
    }

    return name;
  }
}
exports.PyObject = PyObject;

class PyParameter extends PyObject {
  constructor(ctx) {
    super(ctx);
    this.type = this._getType();
    this.default = this._getDefault();
  }

  _getDefault() {}

  _getName() {
    return this._ctx.arg.arg;
  }

  _getType() {
    if (this._ctx.arg.annotation) return this._ctx.arg.annotation.Name.id;
  }
}
exports.PyParameter = PyParameter;

class PyProperty extends PyParameter {
  constructor(ctx) {
    super(ctx);
    this.isStatic = false;
  }
  _getDefault() {
    if (this._ctx.value) {
      if (this._ctx.value.Name) {
        return this._ctx.value.Name.id.toString();
      } else {
        if (this._ctx.value.Constant && this._ctx.value.Constant.value)
          return this._ctx.value.Constant.value.toString();
      }
    }
  }

  _getName() {
    if (this._ctx.target) {
      if (Object.keys(this._ctx.target) == "Attribute") {
        return this._ctx.target.Attribute.attr;
      } else {
        return this._ctx.target.Name.id;
      }
    } else if (this._ctx.targets) {
      if (Object.keys(this._ctx.targets[0]) == "Attribute") {
        return this._ctx.targets[0].Attribute.attr;
      } else {
        return this._ctx.targets[0].Name.id;
      }
    }
  }

  _getType() {
    if (this._ctx.annotation) return this._ctx.annotation.Name.id;
  }
}
exports.PyProperty = PyProperty;

class PyCallable extends PyObject {
  constructor(ctx) {
    super(ctx);
    this.parameters = this._getParameters();
    this.return = this._getReturn();
  }

  _getReturn() {
    if (this._ctx.returns) {
      if (this._ctx.returns.Name) {
        return this._ctx.returns.Name.id.toString();
      } else {
        if (this._ctx.returns.Constant && this._ctx.returns.Constant.value)
          return this._ctx.returns.Constant.value.toString();
      }
    }

    return null;
  }

  _getParameters() {
    var parameters = [];

    if (this._ctx.args) {
      var count =
        this._ctx.args.arguments.args.length -
        this._ctx.args.arguments.defaults.length;

      this._ctx.args.arguments.args.forEach((element, index) => {
        var parameter = new PyParameter(element);
        if (index - count >= 0) {
          parameter.default =
            this._ctx.args.arguments.defaults[index - count].Constant.value;
        }
        parameters.push(parameter);
      });
    }

    return parameters;
  }
}

class PyFunction extends PyCallable {
  constructor(ctx) {
    super(ctx);
    this.objectProperties = this._getObjectProperties();
    this.stereotype = this._getStereotype();
    this.isStatic = this._isStatic();
    this.isConstructor = this._isConstructor();
    this.isMagic = this._isMagic();
  }

  _isStatic() {
    return Boolean(
      this._ctx?.decorator_list?.find(
        (decorator) => decorator?.Name?.id == "staticmethod",
      ),
    );
  }

  _getStereotype() {
    var stereotype = null;

    if (this.name == "__init__") return "constructor";

    this._ctx.decorator_list?.every((decorator) => {
      if (decorator?.Name?.id == "property") {
        stereotype = "property";
        return false;
      }
      if (decorator?.Name?.id == "classmethod") {
        stereotype = "constructor";
        return false;
      }

      return true;
    });

    return stereotype;
  }

  _getObjectProperties() {
    var objectProperties = [];

    this._ctx.body.forEach((element) => {
      if (Object.keys(element) == "Assign") {
        var property = new PyProperty(element.Assign);
        objectProperties.push(property);
      } else if (Object.keys(element) == "AnnAssign") {
        var property = new PyProperty(element.AnnAssign);
        objectProperties.push(property);
      }
    });

    return objectProperties;
  }

  _isConstructor() {
    return this.stereotype == "constructor";
  }

  _isMagic() {
    return this.name.startsWith("__") && this.name.endsWith("__");
  }

  getVisibility() {
    return this.isConstructor
      ? type.UMLModelElement.VK_PUBLIC
      : PyCallable.prototype.getVisibility.call(this);
  }
}
exports.PyFunction = PyFunction;

class PyClass extends PyObject {
  constructor(ctx) {
    super(ctx);
    console.log(ctx);
    this.properties = this._getProperties();
    this.methods = this._getMethods();
    this.bases = this._getBases();
  }

  _getBases() {
    var bases = [];

    this._ctx.bases.forEach((element) => {
      bases.push(element.Name.id.toString());
    });

    return bases;
  }

  _getMethods() {
    var functions = [];

    this._ctx.body.forEach((element) => {
      if (Object.keys(element) == "FunctionDef") {
        var pyFunction = new PyFunction(element.FunctionDef);
        functions.push(pyFunction);
        if (pyFunction.isConstructor) {
          this.properties = this.properties.concat(pyFunction.objectProperties);
        }
      }
    });

    return functions;
  }

  _getProperties(ctx) {
    var properties = [];

    this._ctx.body.forEach((element) => {
      if (Object.keys(element) == "Assign") {
        var property = new PyProperty(element.Assign);
        property.isStatic = true;
        properties.push(property);
      } else if (Object.keys(element) == "AnnAssign") {
        var property = new PyProperty(element.AnnAssign);
        property.isStatic = true;
        properties.push(property);
      }
    });

    return properties;
  }
}
exports.PyClass = PyClass;

class PyModule extends PyObject {
  constructor(ctx) {
    super(ctx);
    this.classes = this._getClasses(ctx.Module.body);
  }

  _getClasses(ctx) {
    var classes = [];

    ctx.forEach((element) => {
      if (Object.keys(element) == "ClassDef") {
        classes.push(new PyClass(element.ClassDef));
      }
    });

    return classes;
  }
}
exports.PyModule = PyModule;

class PyPackage {
  constructor(path, options) {
    this.name = this._getName(path);
    this.modules = [];
    this.packages = [];
    this._options = options;

    var files = fs.readdirSync(path);
    if (files && files.length > 0) {
      files.forEach((entry) => {
        var fullPath = path + "/" + entry;
        this._translatePackagesAndModules(fullPath);
      });
    }
  }

  _getName(path) {
    var packagePath = path.split("/");
    var name = packagePath[packagePath.length - 1];

    return name;
  }

  _translatePackagesAndModules(pth) {
    var stat = fs.lstatSync(pth);
    if (stat.isFile()) {
      var ext = path.extname(pth).toLowerCase();
      if (ext === ".py") {
        try {
          var result = execSync(
            `${this._options.pythonPath} "${path.join(
              __dirname,
              "ast2json.py",
            )}" "${pth}"`,
          );

          var astJson = JSON.parse(result.toString());

          var pyModule = new PyModule(astJson);

          this.modules.push(pyModule);
        } catch (ex) {
          console.error("[Python] Failed to parse - " + pth);
          console.error(ex);
        }
      }
    } else if (stat.isDirectory()) {
      if (isPythonPackage(pth) || isPythonNamespace(pth)) {
        var pyPackage = new PyPackage(pth, this._options);
        this.packages.push(pyPackage);
      }
    }
  }
}
exports.PyPackage = PyPackage;

/**
 * Checking if the path is python package (if contains __init__.py)
 * @param {string} folderPath
 */
function isPythonPackage(folderPath) {
  folderPath = path.join(folderPath, "__init__.py");
  return fs.existsSync(folderPath);
}
exports.isPythonPackage = isPythonPackage;

/**
 * Checking if the path is python namespace (if the folder contains any *.py)
 * @param {string} folderPath
 */
function isPythonNamespace(folderPath) {
  var containModules = false;
  var files = fs.readdirSync(folderPath);

  if (files && files.length > 0) {
    files.every((file) => {
      folderPath = path.join(folderPath, file);

      if (path.extname(folderPath).toLowerCase() === ".py") {
        containModules = true;
        return false;
      }

      return true;
    });
  }

  return containModules;
}
exports.isPythonNamespace = isPythonNamespace;
