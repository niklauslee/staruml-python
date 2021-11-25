class Foo:
    static_var:bool = False
    _static_var:int = 123
    __static_var = 123.456
    
    def __init__(self, x: int = 6):
        self.__x = x
        self._y: str = 'Hello'
        self.z = 123.456

    def foo(self, x: int = 3, y: str = 'Yoohu') -> int:
        pass
    
class _Bar:
    static_bar_var:str = 'Hello'
    static_bar_var_int: int = 123

    def _bar(self):
        pass


class __Baz(Foo, _Bar):
    def __baz(self):
        pass
