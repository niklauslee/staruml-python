> # LOOKING FOR A NEW MAINTAINER
> If you are interested to be a new maintainer, please create an issue with the title "Become a new maintainer".

Python Extension for StarUML
============================

This extension for StarUML(http://staruml.io) support to generate Python code from UML model. Install this extension from Extension Manager of StarUML.

Python Code Generation
----------------------

1. Click the menu (`Tools > Python > Generate Code...`)
2. Select a base model (or package) that will be generated to Python.
3. Select a folder where generated Python source files (.py) will be placed.

Belows are the rules to convert from UML model elements to Python source codes.

### UMLPackage

* converted to a python _Package_ (as a folder with `__init__.py`).

### UMLClass, UMLInterface

* converted to a python _Class_ definition as a separated module (`.py`).
* Default constructor is generated (`def __init__(self):`)
* `documentation` property to docstring

### UMLEnumeration

* converted to a python class inherited from _Enum_ as a separated module (`.py`).
* literals converted to class variables

### UMLAttribute, UMLAssociationEnd

* converted to an instance variable if `isStatic` property is false, or a class variable if `isStatic` property is true
* `name` property to identifier
* `documentation` property to docstring
* If `multiplicity` is one of `0..*`, `1..*`, `*`, then the variable will be initialized with `[]`.

### UMLOperation

* converted to an instance method if `isStatic` property is false, or a class method (`@classmethod`) if `isStatic` property is true
* `name` property to identifier
* `documentation` property to docstring
* _UMLParameter_ to method parameter

### UMLGeneralization, UMLInterfaceRealization

* converted to inheritance

