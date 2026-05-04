/**
 * Dağıtım sürümü: her anlamlı release'de version.json içindeki "v" değerini artır.
 * Kullanıcıdan manuel yenileme istenmez; yeni sürümde bir kez otomatik reload olur.
 */
(function () {
    var LS = 'trackerDeployedV';
    function applyVersion(cur) {
        var c = Number(cur) || 0;
        if (!c) return;
        var s = Number(localStorage.getItem(LS) || '0') || 0;
        if (c > s) {
            try {
                localStorage.setItem(LS, String(c));
            } catch (_) {
                return;
            }
            if (s > 0) {
                window.location.reload();
            }
        }
    }
    function poll() {
        try {
            fetch('./version.json?t=' + Date.now(), { cache: 'no-store' })
                .then(function (r) {
                    return r.ok ? r.json() : null;
                })
                .then(function (d) {
                    if (d && d.v != null) applyVersion(d.v);
                })
                .catch(function () {});
        } catch (_) {}
    }
    poll();
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') poll();
        });
    }
})();
