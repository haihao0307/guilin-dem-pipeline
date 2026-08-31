from dataclasses import dataclass

@dataclass(frozen=True)
class Window:
    col_off: int
    row_off: int
    width: int
    height: int
