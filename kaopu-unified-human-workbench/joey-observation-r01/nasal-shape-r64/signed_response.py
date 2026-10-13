"""Original bounded response interpolation; native positive/negative morphs are independent."""
from dataclasses import dataclass
import numpy as np

@dataclass
class SignedResponse:
    zero: np.ndarray
    negative: np.ndarray
    positive: np.ndarray
    negative_limit: float
    positive_limit: float

    def __post_init__(self):
        self.zero=np.asarray(self.zero,dtype=float).copy()
        self.negative=np.asarray(self.negative,dtype=float).copy()
        self.positive=np.asarray(self.positive,dtype=float).copy()
        if self.negative_limit>=0 or self.positive_limit<=0 or not np.isfinite([self.negative_limit,self.positive_limit]).all():raise ValueError('Finite negative and positive limits required')
        if self.zero.shape!=self.negative.shape or self.zero.shape!=self.positive.shape or not all(np.isfinite(a).all() for a in [self.zero,self.negative,self.positive]):raise ValueError('Matching finite native response arrays required')

    def at(self,value):
        if not np.isfinite(value) or value<self.negative_limit or value>self.positive_limit:raise ValueError('Requested control is outside measured native branches')
        endpoint,limit=(self.negative,self.negative_limit) if value<0 else (self.positive,self.positive_limit)
        return self.zero+(endpoint-self.zero)*(value/limit)

    def delta(self,before,after):
        return self.at(after)-self.at(before)


def compose_native(anchor,changes):
    """Each tuple is (response,before,after). True-forward check remains mandatory."""
    a=np.asarray(anchor,dtype=float)
    if not np.isfinite(a).all():raise ValueError('Finite anchor required')
    out=a.copy()
    for response,before,after in changes:
        delta=response.delta(before,after)
        if delta.shape!=out.shape:raise ValueError('Native response topology mismatch')
        out+=delta
    return out
