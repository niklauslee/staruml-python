import ast
import sys
import json

def classname(cls):
    return cls.__class__.__name__

def jsonify_ast(node, level=0):
    """
    https://github.com/maligree/python-ast-explorer/blob/master/parse.py
    """
    fields = {}
    for k in node._fields:
        fields[k] = '...'
        v = getattr(node, k)
        if isinstance(v, ast.AST):
            if v._fields:
                fields[k] = jsonify_ast(v)
            else:
                fields[k] = classname(v)

        elif isinstance(v, list):
            fields[k] = []
            for e in v:
                fields[k].append(jsonify_ast(e))

        elif isinstance(v, str):
            fields[k] = v

        elif isinstance(v, int) or isinstance(v, float):
            fields[k] = v

        elif v is None:
            fields[k] = None

        else:
            fields[k] = 'unrecognized'

    ret = { classname(node): fields }
    return ret


with open(sys.argv[1]) as py_file:
    code = py_file.read()
    tree = ast.parse(code)
    print(json.dumps(jsonify_ast(tree)))