"""Backward-compatible wrapper: services/location.py still calls fetch_daily(lat, lon).
New code should use services/nasa_power.py + services/data_processing.py directly."""
from datetime import date

from . import nasa_power
from .derive import clean


def fetch_daily(lat, lon, start=19910101, end=20201231):
    s, e = date(start // 10000, start // 100 % 100, start % 100), date(end // 10000, end // 100 % 100, end % 100)
    resp = nasa_power.fetch_daily(lat, lon, s, e, params=["PRECTOTCORR", "T2M", "T2M_MAX", "T2M_MIN", "RH2M", "WS2M", "ALLSKY_SFC_SW_DWN"])
    days = sorted(resp.daily["PRECTOTCORR"].keys())
    return [{"date": d, **{k: clean(resp.daily[k].get(d)) for k in resp.daily}} for d in days]
