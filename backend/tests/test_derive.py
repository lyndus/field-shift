from app.services import derive

def test_et0_fao56_example():
    # FAO-56 Example 18 (Uccle, Belgium, 6 July): ET0 ~ 3.9 mm/day
    # Using its inputs: Tmax 21.5, Tmin 12.3, RH~73.5, u2 2.078, Rs 22.07, lat 50.8, doy 187, elev 100
    v = derive.et0_fao56(21.5, 12.3, 73.5, 2.078, 22.07, 50.8, 187, elev=100)
    assert 3.5 < v < 4.4

def test_onset():
    daily = [(i, 0) for i in range(20)]
    daily[10] = (10, 12); daily[11] = (11, 9)
    assert derive.sowing_onset(daily) == 10
    assert derive.sowing_onset([(i, 1) for i in range(20)]) is None

def test_trend_not_significant_for_noise():
    xs = list(range(1991, 2021))
    ys = [300, 250, 310, 280, 290, 260, 305, 270, 295, 285] * 3
    assert derive.theil_sen(xs, ys)["significant"] is False

def test_trend_significant_for_clear_slope():
    xs = list(range(1991, 2021))
    t = derive.theil_sen(xs, [x * 2.0 for x in xs])
    assert t["significant"] and abs(t["slope"] - 2.0) < 1e-6

def test_paw_loam_reasonable():
    paw = derive.plant_available_water(20, 40, 2.0)
    assert 90 < paw < 220  # loam ~ 100-200 mm/m

def test_fill_value():
    assert derive.clean(-999) is None and derive.clean(3.2) == 3.2

def test_validate():
    assert derive.validate_vs_reference(300, 400)["ok"] is True
    assert derive.validate_vs_reference(100, 400)["ok"] is False
