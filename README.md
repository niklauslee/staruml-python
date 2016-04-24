Python Extension for StarUML 2
==============================

This extension for StarUML(http://staruml.io) support to generate Python code from UML model. Install this extension from Extension Manager of StarUML.

Python Code Generation
----------------------

1. Click the menu (`Tools > Python > Generate Code...`)
2. Select a base model (or package) that will be generated to Python.
3. Select a folder where generated Python source files (.py) will be placed.

Belows are the rules to convert from UML model elements to Python source codes.

### UMLPackage

* converted to a _Python Package_ (as a folder with `__init__.py`).

### UMLClass, UMLInterface

* converted to a _Python Module_ with a _Python Class_ definition.
