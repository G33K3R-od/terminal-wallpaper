var userPropsState = {};

var onUserPropertiesApplied = null;



function applySchemeColorProperty(properties) {

  if (!properties.schemecolor) return;

  var raw = properties.schemecolor.value;

  if (!raw) return;

  var parts = String(raw).trim().split(/\s+/).map(parseFloat);

  if (parts.length < 3) return;

  var rgb = parts.map(function (v) {

    var n = v > 1 ? v : v * 255;

    return Math.min(255, Math.max(0, Math.round(n)));

  });

  document.documentElement.style.setProperty('--accent', 'rgb(' + rgb.join(',') + ')');

}



function mergeUserProperties(properties) {

  Object.keys(properties).forEach(function (key) {

    var p = properties[key];

    if (p && Object.prototype.hasOwnProperty.call(p, 'value')) {

      userPropsState[key] = p.value;

    }

  });

}



window.wallpaperPropertyListener = {

  applyUserProperties: function (properties) {

    applySchemeColorProperty(properties);

    mergeUserProperties(properties);

    if (onUserPropertiesApplied) {

      onUserPropertiesApplied();

    }

  }

};



(function () {

  'use strict';



  var SECTION_I18N = {

    ru: {

      clocks: 'Часы',

      timers: 'Таймеры',

      audio: 'Аудио',

      network: 'Сеть',

      media: 'Медиа'

    },

    en: {

      clocks: 'Clocks',

      timers: 'Timers',

      audio: 'Audio',

      network: 'Network',

      media: 'Media'

    }

  };



  var WEATHER_CITIES = window.DASHBOARD_WEATHER_CITIES || {};

  var TZ_WEATHER = window.DASHBOARD_TZ_WEATHER || {};

  var defaults = window.DASHBOARD_CONFIG || { clocks: [], timers: [], statsPollMs: 1500, barWidth: 16 };

  var cfg = {

    clocks: defaults.clocks.slice(),

    timers: defaults.timers.slice(),

    statsPollMs: defaults.statsPollMs || 1500,

    barWidth: defaults.barWidth || 16,

    localClockShow: defaults.localClockShow !== false,

    weatherShow: defaults.weatherShow !== false,

    weatherCity: defaults.weatherCity || 'sao_paulo',

    weatherLat: -23.55,

    weatherLon: -46.63,

    weatherLabel: 'Sao Paulo',

    sectionLang: defaults.sectionLang === 'en' ? 'en' : 'ru'

  };

  applyWeatherCity(cfg.weatherCity);

  var elDash = document.getElementById('dashboard');

  var elViewport = document.getElementById('viewport');

  var elPanel = document.querySelector('.panel');

  var fitTimer = null;

  var stats = {};

  var media = { title: '', artist: '', album: '', status: 'Idle' };

  var mediaTimeline = { position: 0, duration: 0, syncedAt: 0 };

  var audioLevels = { bass: 0, mid: 0, treble: 0, volume: 0 };

  var audioSmooth = { bass: 0, mid: 0, treble: 0, volume: 0 };

  var weather = { temp: null, text: '—' };

  var weatherFetchedAt = 0;

  var weatherLoading = false;

  var audioGain = defaults.audioGain != null ? Number(defaults.audioGain) : 2.8;

  if (isNaN(audioGain) || audioGain < 1) {

    audioGain = 2.8;

  }



  var elSys = document.getElementById('sysinfo');

  var elClocks = document.getElementById('clocks');

  var elTimers = document.getElementById('timers');

  var elAudio = document.getElementById('audio');

  var elNet = document.getElementById('netdate');

  var elPlayer = document.getElementById('player');
  var elLogoMeta = document.getElementById('logo-meta');
  var elLogoBars = document.getElementById('logo-bars');



  function esc(s) {

    if (s == null) return '';

    var d = document.createElement('div');

    d.textContent = String(s);

    return d.innerHTML;

  }



  function propStr(key, fallback) {

    if (!Object.prototype.hasOwnProperty.call(userPropsState, key)) {

      return fallback;

    }

    var v = userPropsState[key];

    if (v == null || String(v).trim() === '') {

      return fallback;

    }

    return String(v).trim();

  }



  function propBool(key, fallback) {

    if (!Object.prototype.hasOwnProperty.call(userPropsState, key)) {

      return fallback;

    }

    return !!userPropsState[key];

  }



  function applyWeatherCity(cityKey) {

    var c = WEATHER_CITIES[cityKey] || WEATHER_CITIES.sao_paulo;

    if (!c) {

      cfg.weatherLat = -23.55;

      cfg.weatherLon = -46.63;

      cfg.weatherLabel = 'Sao Paulo';

      cfg.weatherCity = 'sao_paulo';

      return;

    }

    cfg.weatherCity = cityKey;

    cfg.weatherLat = c.lat;

    cfg.weatherLon = c.lon;

    cfg.weatherLabel = c.label;

  }



  function parseCustomWeatherCoords() {

    var raw = propStr('weathercoords', defaults.weatherCoords || '');

    if (!raw) {

      return null;

    }

    var parts = raw.replace(/;/g, ',').split(/[,\s]+/).filter(Boolean);

    if (parts.length < 2) {

      return null;

    }

    var lat = parseFloat(parts[0]);

    var lon = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {

      return null;

    }

    return { lat: lat, lon: lon };

  }



  function applyWeatherCustom() {

    var coords = parseCustomWeatherCoords();

    if (!coords) {

      return false;

    }

    cfg.weatherCity = 'custom';

    cfg.weatherLat = coords.lat;

    cfg.weatherLon = coords.lon;

    cfg.weatherLabel =

      (coords.lat >= 0 ? coords.lat.toFixed(2) + '°N' : -coords.lat.toFixed(2) + '°S') +

      ', ' +

      (coords.lon >= 0 ? coords.lon.toFixed(2) + '°E' : -coords.lon.toFixed(2) + '°W');

    return true;

  }



  function resolveWeatherCityKey() {

    var key = propStr('weathercity', cfg.weatherCity || 'komsomolsk');

    if (key === 'custom' || key === 'clock1') {

      return key;

    }

    if (WEATHER_CITIES[key]) {

      return key;

    }

    return 'komsomolsk';

  }



  function syncWeatherFromProps() {

    var key = resolveWeatherCityKey();

    if (key === 'custom') {

      if (!applyWeatherCustom()) {

        applyWeatherCity('komsomolsk');

      }

      return;

    }

    if (key === 'clock1') {

      var tz = propStr('clock1tz', 'Asia/Vladivostok');

      applyWeatherCity(TZ_WEATHER[tz] || 'komsomolsk');

      return;

    }

    applyWeatherCity(key);

  }



  function normalizeOs(text) {

    if (!text) return text;

    return String(text)

      .replace(/^(Microsoft|Майкрософт)\s+/i, '')

      .replace(/Профессиональная/gi, 'Pro')

      .replace(/Домашняя/gi, 'Home')

      .replace(/для дома/gi, 'Home')

      .replace(/Корпоративная/gi, 'Enterprise')

      .replace(/Образовательная/gi, 'Education')

      .trim();

  }



  function applySectionI18n() {

    var dict = SECTION_I18N[cfg.sectionLang] || SECTION_I18N.en;

    document.querySelectorAll('[data-i18n]').forEach(function (el) {

      var key = el.getAttribute('data-i18n');

      if (dict[key]) {

        el.textContent = dict[key];

      }

    });

  }



  function rebuildCfgFromProps() {

    if (!Object.keys(userPropsState).length) {

      return;

    }



    var clocks = [];

    var i;

    for (i = 1; i <= 3; i++) {

      if (!propBool('clock' + i + 'show', true)) {

        continue;

      }

      var tz = propStr('clock' + i + 'tz', '');

      if (!tz) {

        continue;

      }

      clocks.push({

        id: i - 1,

        label: propStr('clock' + i + 'label', 'Clock ' + i),

        tz: tz

      });

    }



    var timers = [];

    for (i = 1; i <= 3; i++) {

      if (!propBool('timer' + i + 'show', true)) {

        continue;

      }

      var date = propStr('timer' + i + 'date', '');

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {

        continue;

      }

      timers.push({

        id: i - 1,

        label: propStr('timer' + i + 'name', 'Event ' + i),

        date: date

      });

    }



    cfg.clocks = clocks;

    cfg.timers = timers;

    cfg.localClockShow = propBool('localclockshow', cfg.localClockShow);

    cfg.weatherShow = propBool('weathershow', cfg.weatherShow);

    syncWeatherFromProps();



    var lang = propStr('sectionlang', cfg.sectionLang);

    cfg.sectionLang = lang === 'en' ? 'en' : 'ru';



    if (Object.prototype.hasOwnProperty.call(userPropsState, 'barwidth')) {

      var bw = Number(userPropsState.barwidth);

      if (!isNaN(bw)) {

        cfg.barWidth = Math.max(8, Math.min(24, Math.round(bw)));

      }

    }



    if (Object.prototype.hasOwnProperty.call(userPropsState, 'audiogain')) {

      var ag = Number(userPropsState.audiogain);

      if (!isNaN(ag)) {

        audioGain = Math.max(1, Math.min(5, ag));

      }

    }

  }



  function isStatsStale() {

    if (!stats.updated) {

      return true;

    }

    var t = Date.parse(stats.updated);

    if (isNaN(t)) {

      return true;

    }

    return Date.now() - t > 12000;

  }



  function hasLiveStats() {

    if (!propBool('showpcstats', true)) {

      return false;

    }

    if (isStatsStale()) {

      return false;

    }

    return !!(stats.os || stats.host || stats.cpu || stats.memory);

  }



  function updatePanelMode() {

    var live = hasLiveStats();

    if (elPanel) {

      elPanel.classList.toggle('panel-standalone', !live);

      elPanel.classList.toggle('panel-stats-live', live);

      elPanel.classList.remove('panel-stale');

    }

    if (elSys) {

      elSys.style.display = live ? '' : 'none';

    }

  }



  function updatePanelStale() {

    updatePanelMode();

  }



  function line(label, value) {

    return (

      '<div class="kv-row">' +

      '<span class="label">' + esc(label) + '</span>' +

      '<span class="value">' + esc(value) + '</span>' +

      '</div>'

    );

  }



  function lineWithBar(label, value, pct) {

    var ratio = pct != null && !isNaN(pct) ? Math.min(1, Math.max(0, pct / 100)) : 0;

    return (

      '<div class="metric-block">' +

      '<div class="kv-row">' +

      '<span class="label">' + esc(label) + '</span>' +

      '<span class="value">' + esc(value) + '</span>' +

      '</div>' +

      '<div class="metric-bar-row">' + textBar(ratio, cfg.barWidth, 'bar-scheme') + '</div>' +

      '</div>'

    );

  }



  function fitToViewport() {

    if (!elDash) return;

    elDash.style.transform = 'none';

    var availW = elViewport ? elViewport.clientWidth : window.innerWidth;

    var availH = elViewport ? elViewport.clientHeight : window.innerHeight;

    var w = elDash.scrollWidth;

    var h = elDash.scrollHeight;

    if (!w || !h) return;

    var scale = Math.min(1, availW / w, availH / h);

    elDash.style.transform = scale < 0.995 ? 'scale(' + scale + ')' : 'none';

  }



  function scheduleFit() {

    if (fitTimer) clearTimeout(fitTimer);

    fitTimer = setTimeout(function () {

      fitTimer = null;

      requestAnimationFrame(fitToViewport);

    }, 0);

  }



  function textBar(ratio, width, cls) {

    var w = width || cfg.barWidth || 28;

    var n = Math.max(0, Math.min(w, Math.round(ratio * w)));

    var html = '<span class="bar ' + cls + '">';

    var i;

    for (i = 0; i < n; i++) {

      html += '<span class="bar-fill bar-fill-' + Math.min(5, Math.floor((i / w) * 6)) + '">|</span>';

    }

    for (i = n; i < w; i++) {

      html += '<span class="bar-empty">|</span>';

    }

    html += '</span>';

    return html;

  }



  function audioBar(ratio) {

    var w = cfg.barWidth || 28;

    var n = Math.max(0, Math.min(w, Math.round(ratio * w)));

    var html = '<span class="bar bar-audio">';

    var i;

    for (i = 0; i < n; i++) {

      html += '<span class="bar-fill">|</span>';

    }

    for (i = n; i < w; i++) {

      html += '<span class="bar-empty">|</span>';

    }

    html += '</span>';

    return html;

  }



  function formatMediaTime(sec) {

    sec = Math.max(0, Math.floor(sec || 0));

    var m = Math.floor(sec / 60);

    var s = sec % 60;

    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;

  }



  function applyMediaTimeline(event) {

    if (!event) return;

    mediaTimeline.position = event.position || 0;

    mediaTimeline.duration = event.duration || 0;

    mediaTimeline.syncedAt = Date.now();

  }



  function getDisplayPosition() {

    if (media.status !== 'Playing') {

      return mediaTimeline.position;

    }

    var elapsed = (Date.now() - (mediaTimeline.syncedAt || 0)) / 1000;

    var pos = mediaTimeline.position + elapsed;

    if (mediaTimeline.duration > 0 && pos > mediaTimeline.duration) {

      return mediaTimeline.duration;

    }

    return pos;

  }



  function playerTimeText() {

    return (

      '[' +

      formatMediaTime(getDisplayPosition()) +

      '/' +

      formatMediaTime(mediaTimeline.duration) +

      ']'

    );

  }



  function updatePlayerTimeEl() {

    if (!elPlayer) return;

    var el = elPlayer.querySelector('.player-time');

    if (el) {

      el.textContent = playerTimeText();

    }

  }



  function weatherCodeText(code) {

    var c = Number(code);

    if (c === 0) return 'Clear';

    if (c >= 1 && c <= 3) return 'Cloudy';

    if (c === 45 || c === 48) return 'Fog';

    if (c >= 51 && c <= 57) return 'Drizzle';

    if (c >= 61 && c <= 67) return 'Rain';

    if (c >= 71 && c <= 77) return 'Snow';

    if (c >= 80 && c <= 82) return 'Showers';

    if (c >= 95) return 'Storm';

    return 'Weather';

  }



  function loadWeather() {

    if (!cfg.weatherShow) {

      return;

    }

    if (weatherLoading) {

      return;

    }

    if (weatherFetchedAt && Date.now() - weatherFetchedAt < 20 * 60 * 1000) {

      return;

    }

    weatherLoading = true;

    var url =

      'https://api.open-meteo.com/v1/forecast?latitude=' +

      encodeURIComponent(cfg.weatherLat) +

      '&longitude=' +

      encodeURIComponent(cfg.weatherLon) +

      '&current=temperature_2m,weather_code&timezone=auto';

    fetch(url)

      .then(function (r) {

        if (!r.ok) throw new Error('weather');

        return r.json();

      })

      .then(function (data) {

        var cur = data && data.current;

        if (cur) {

          weather.temp = cur.temperature_2m;

          weather.text = weatherCodeText(cur.weather_code);

        }

        weatherFetchedAt = Date.now();

        renderNetdate();

        scheduleFit();

      })

      .catch(function () {

        weather.text = '—';

      })

      .then(function () {

        weatherLoading = false;

      });

  }



  function renderLogoBars() {
    if (!elLogoBars) {
      return;
    }
    var levels = [
      audioLevels.bass,
      audioLevels.mid,
      audioLevels.treble,
      audioLevels.volume,
      audioLevels.bass * 0.9,
      audioLevels.mid * 0.85,
      audioLevels.treble * 0.8,
      audioLevels.volume * 0.75,
      audioLevels.bass * 0.6,
      audioLevels.mid * 0.55,
      audioLevels.treble * 0.5,
      audioLevels.volume * 0.45
    ];
    var html = '';
    var i;
    for (i = 0; i < 12; i++) {
      var h = Math.round(Math.min(1, levels[i] || 0) * 100);
      if (h < 12) {
        h = 12;
      }
      html += '<span class="logo-bar" style="--h:' + h + '%"></span>';
    }
    elLogoBars.innerHTML = html;
  }

  function initLogoBars() {
    if (!elLogoBars) {
      return;
    }
    var heights = [28, 45, 62, 38, 55, 72, 48, 65, 35, 52, 40, 58];
    var html = '';
    var i;
    for (i = 0; i < 12; i++) {
      html += '<span class="logo-bar" style="--h:' + heights[i] + '%"></span>';
    }
    elLogoBars.innerHTML = html;
  }

  function renderLogoMeta() {
    if (!elLogoMeta) {
      return;
    }

    if (!hasLiveStats()) {
      var host = propStr('displayhost', '');
      var user = propStr('displayuser', '');
      var ru = cfg.sectionLang === 'ru';
      var html = '';

      if (host) {
        html +=
          '<div class="logo-kv"><span class="logo-kv-l">host</span><span class="logo-kv-v">' +
          esc(host) +
          '</span></div>';
      }
      if (user) {
        html +=
          '<div class="logo-kv"><span class="logo-kv-l">user</span><span class="logo-kv-v">' +
          esc(user) +
          '</span></div>';
      }

      html +=
        '<div class="logo-kv"><span class="logo-kv-l">mode</span><span class="logo-kv-v logo-live">' +
        esc(ru ? 'автономный' : 'standalone') +
        '</span></div>' +
        '<div class="logo-features">' +
        '<div>' +
        esc(ru ? '· часы · погода · таймеры' : '· clocks · weather · timers') +
        '</div>' +
        '<div>' +
        esc(ru ? '· аудио · медиа' : '· audio · media') +
        '</div>' +
        '<div class="logo-features-note">' +
        esc(
          ru
            ? 'CPU/RAM/GPU — опционально, setup.bat (Win)'
            : 'PC stats optional — setup.bat (Win)'
        ) +
        '</div></div>';

      elLogoMeta.innerHTML = html;
      return;
    }

    var s = stats;
    var html =
      '<div class="logo-kv"><span class="logo-kv-l">host</span><span class="logo-kv-v">' +
      esc(s.host || '—') +
      '</span></div>' +
      '<div class="logo-kv"><span class="logo-kv-l">user</span><span class="logo-kv-v">' +
      esc(s.username || '—') +
      '</span></div>' +
      '<div class="logo-kv"><span class="logo-kv-l">stats</span><span class="logo-kv-v logo-live">live</span></div>';

    if (s.cpuPct != null && !isNaN(s.cpuPct)) {
      html +=
        '<div class="logo-mini-metric">' +
        '<div class="logo-mini-head"><span>cpu</span><span>' +
        esc(s.cpuPct + '%') +
        '</span></div>' +
        '<div class="logo-mini-bar"><span class="logo-mini-fill" style="width:' +
        Math.min(100, s.cpuPct) +
        '%"></span></div></div>';
    }
    if (s.memoryPct != null && !isNaN(s.memoryPct)) {
      html +=
        '<div class="logo-mini-metric">' +
        '<div class="logo-mini-head"><span>ram</span><span>' +
        esc(s.memoryPct + '%') +
        '</span></div>' +
        '<div class="logo-mini-bar"><span class="logo-mini-fill" style="width:' +
        Math.min(100, s.memoryPct) +
        '%"></span></div></div>';
    }
    elLogoMeta.innerHTML = html;
  }

  function renderSysinfo() {

    renderLogoMeta();

    updatePanelMode();

    if (!hasLiveStats()) {

      if (elSys) {

        elSys.innerHTML = '';

      }

      return;

    }

    var s = stats;

    var html = '';

    html +=

      line('OS', normalizeOs(s.os)) +

      (s.wifi ? line('Wi-Fi', s.wifi) : '') +

      line('Kernel', s.kernel) +

      line('Motherboard', s.motherboard) +

      line('Uptime', s.uptime) +

      line('Shell', s.shell) +

      line('Resolution', s.resolution) +

      line('CPU', s.cpu) +

      line('GPU', s.gpu);

    if (s.gpuTemp != null && !isNaN(s.gpuTemp)) {

      html += line('GPU Temp', s.gpuTemp + ' °C');

    }

    if (s.gpuPct != null && !isNaN(s.gpuPct)) {

      html += line('GPU Load', s.gpuPct + '%');

    }

    if (s.cpuPct != null && !isNaN(s.cpuPct)) {

      html += lineWithBar('CPU Load', s.cpuUsage || s.cpuPct + '%', s.cpuPct);

    }

    html += lineWithBar('Memory', s.memory, s.memoryPct);

    html += lineWithBar('Disk', s.disk, s.diskPct);

    if (s.disks && s.disks.length) {

      s.disks.forEach(function (d) {

        var id = String(d.id || '').toUpperCase();

        if (id === 'C:') {

          return;

        }

        html += lineWithBar(

          'Disk ' + id,

          d.used + ' / ' + d.total + ' (' + d.pct + '%)',

          d.pct

        );

      });

    }

    elSys.innerHTML = html;

  }



  function dayProgressInTz(tz) {

    var parts = new Intl.DateTimeFormat('en-US', {

      timeZone: tz,

      hour: 'numeric',

      minute: 'numeric',

      second: 'numeric',

      hour12: false

    }).formatToParts(new Date());

    var h = 0;

    var m = 0;

    var sec = 0;

    parts.forEach(function (p) {

      if (p.type === 'hour') h = parseInt(p.value, 10);

      if (p.type === 'minute') m = parseInt(p.value, 10);

      if (p.type === 'second') sec = parseInt(p.value, 10);

    });

    return (h * 3600 + m * 60 + sec) / 86400;

  }



  function formatClock(tz) {

    var now = new Date();

    return new Intl.DateTimeFormat('en-GB', {

      timeZone: tz,

      hour: '2-digit',

      minute: '2-digit',

      second: '2-digit',

      hour12: false

    }).format(now);

  }



  function relativeDayLabel(tz) {

    var userDay = new Date().toLocaleDateString('en-CA');

    var tzDay = new Intl.DateTimeFormat('en-CA', {

      timeZone: tz,

      year: 'numeric',

      month: '2-digit',

      day: '2-digit'

    }).format(new Date());

    if (tzDay < userDay) return 'Yesterday';

    if (tzDay > userDay) return 'Tomorrow';

    return 'Today';

  }



  function clockBlockHtml(clockId, label, tz) {

    var prog = dayProgressInTz(tz);

    return (

      '<div class="clock-block">' +

      '<div class="clock-row-head">' +

      '<span class="clock-label"><span class="label">' + esc(clockId) + '</span></span>' +

      '<span class="clock-loc">[' + esc(label) + ']</span>' +

      '<span class="clock-day">' + esc(relativeDayLabel(tz)) + '</span>' +

      '<span class="clock-time">' + esc(formatClock(tz)) + '</span>' +

      '</div>' +

      '<div class="clock-row-bar">' + textBar(prog, cfg.barWidth, 'bar-day') + '</div>' +

      '</div>'

    );

  }



  function getLocalTimeZone() {

    try {

      return Intl.DateTimeFormat().resolvedOptions().timeZone;

    } catch (e) {

      return null;

    }

  }



  function renderClocks() {

    var html = '';

    var localTz = getLocalTimeZone();

    var hasLocal = false;



    if (cfg.localClockShow && localTz) {

      hasLocal = cfg.clocks.some(function (c) {

        return c.tz === localTz;

      });

      if (!hasLocal) {

        html += clockBlockHtml('Clock LOCAL', 'LOCAL', localTz);

      }

    }



    cfg.clocks.forEach(function (c) {

      html += clockBlockHtml('Clock ' + c.id, c.label, c.tz);

    });

    elClocks.innerHTML = html;

  }



  function daysUntil(dateStr) {

    var target = new Date(dateStr + 'T00:00:00');

    var today = new Date();

    today.setHours(0, 0, 0, 0);

    target.setHours(0, 0, 0, 0);

    return Math.ceil((target - today) / 86400000);

  }



  function renderTimers() {

    var html = '';

    cfg.timers.forEach(function (t) {

      var d = daysUntil(t.date);

      var text = d === 0 ? 'Today!' : d + ' day' + (d === 1 ? '' : 's') + ' left';

      var soon = d >= 0 && d <= 7 ? ' timer-soon' : '';

      html +=

        '<div class="timer-row' + soon + '">' +

        '<span class="label">Timer ' + t.id + '</span>' +

        '<span class="timer-name">[' + esc(t.label) + ']</span>' +

        '<span class="timer-days">' + esc(text) + '</span>' +

        '</div>';

    });

    elTimers.innerHTML = html;

  }



  function renderAudio() {

    var pct = function (v) {

      return Math.round(Math.min(1, v) * 100) + '%';

    };

    elAudio.innerHTML =

      '<div class="audio-row"><span class="label">Bass</span>' + audioBar(audioLevels.bass) + '<span class="dim">' + pct(audioLevels.bass) + '</span></div>' +

      '<div class="audio-row"><span class="label">Mid</span>' + audioBar(audioLevels.mid) + '<span class="dim">' + pct(audioLevels.mid) + '</span></div>' +

      '<div class="audio-row"><span class="label">Treble</span>' + audioBar(audioLevels.treble) + '<span class="dim">' + pct(audioLevels.treble) + '</span></div>' +

      '<div class="audio-row"><span class="label">Volume</span>' + audioBar(audioLevels.volume) + '<span class="dim">' + pct(audioLevels.volume) + '</span></div>';

    renderLogoBars();

  }



  function renderNetdate() {

    var d = new Date();

    var dateStr = d.toLocaleDateString('en-US', {

      weekday: 'short',

      month: '2-digit',

      day: '2-digit',

      year: 'numeric'

    });

    var html = line('IP Address', stats.ip || '—') + line('Date', dateStr);

    if (cfg.weatherShow) {

      var place = cfg.weatherLabel ? ' (' + cfg.weatherLabel + ')' : '';

      var w =

        weather.temp != null

          ? Math.round(weather.temp) + '°C · ' + weather.text + place

          : weather.text + place;

      html += line('Weather', w);

    }

    elNet.innerHTML = html;

  }



  function renderPlayer() {

    var hasTrack = media.title || media.artist;

    if (!hasTrack && (media.status === 'Idle' || media.status === 'Stopped')) {

      elPlayer.className = 'section-body player player-compact';

      elPlayer.innerHTML =

        '<div class="player-idle"><span class="dim">No media</span></div>';

      scheduleFit();

      return;

    }

    elPlayer.className = 'section-body player';

    var status = media.status || (hasTrack ? 'Playing' : 'Idle');

    var title = media.title || '—';

    var artist = media.artist || '—';

    var album = media.album || '—';

    elPlayer.innerHTML =

      '<div class="player-head"><span>Status</span><span>Artist</span><span>Title</span><span>Album</span><span>Track</span></div>' +

      '<div class="player-row">' +

      '<span class="player-status">' + esc(status) + '</span>' +

      '<span class="player-artist">' + esc(artist) + '</span>' +

      '<span class="player-title">' + esc(title) + '</span>' +

      '<span class="player-album">' + esc(album) + '</span>' +

      '<span class="player-time">' + esc(playerTimeText()) + '</span>' +

      '</div>';

    scheduleFit();

  }



  function renderAll() {

    applySectionI18n();

    renderSysinfo();

    renderClocks();

    renderTimers();

    renderAudio();

    renderNetdate();

    renderPlayer();

    scheduleFit();

  }



  function loadStats() {

    fetch('stats.json?t=' + Date.now())

      .then(function (r) {

        if (!r.ok) throw new Error('stats');

        return r.json();

      })

      .then(function (data) {

        stats = data;

        renderSysinfo();

        renderNetdate();

        scheduleFit();

      })

      .catch(function () {

        updatePanelStale();

      });

  }



  function stereoSample(arr, index) {

    var l = arr[index] || 0;

    var r = arr.length > 64 ? arr[index + 64] || 0 : l;

    return Math.max(l, r);

  }



  function bandLevel(arr, from, to) {

    var max = 0;

    var sum = 0;

    var n = 0;

    var i;

    for (i = from; i < to && i < 64; i++) {

      var v = stereoSample(arr, i);

      if (v > max) {

        max = v;

      }

      sum += v;

      n++;

    }

    if (!n) {

      return 0;

    }

    return max * 0.8 + (sum / n) * 0.2;

  }



  function mapAudioLevel(raw) {

    var v = Math.max(0, raw) * audioGain;

    if (v > 1) {

      v = 1;

    }

    return Math.sqrt(v);

  }



  function smoothAudio(key, target) {

    var cur = audioSmooth[key];

    var rate = target > cur ? 0.5 : 0.22;

    cur += (target - cur) * rate;

    audioSmooth[key] = cur;

    return cur;

  }



  function wallpaperAudioListener(audioArray) {

    if (!audioArray || !audioArray.length) return;

    audioLevels.bass = smoothAudio('bass', mapAudioLevel(bandLevel(audioArray, 0, 14)));

    audioLevels.mid = smoothAudio('mid', mapAudioLevel(bandLevel(audioArray, 14, 40)));

    audioLevels.treble = smoothAudio('treble', mapAudioLevel(bandLevel(audioArray, 40, 64)));

    audioLevels.volume = smoothAudio('volume', mapAudioLevel(bandLevel(audioArray, 0, 64)));

    renderAudio();

  }



  function wallpaperMediaPropertiesListener(event) {

    if (!event) return;

    media.title = event.title || '';

    media.artist = event.artist || '';

    media.album = event.albumTitle || event.album || '';

    if (media.title || media.artist) {

      if (media.status === 'Idle' || media.status === 'Stopped') {

        media.status = 'Playing';

      }

    } else if (media.status === 'Playing') {

      media.status = 'Idle';

    }

    renderPlayer();

  }



  function wallpaperMediaTimelineListener(event) {

    applyMediaTimeline(event);

    if (elPlayer.querySelector('.player-time')) {

      updatePlayerTimeEl();

    } else {

      renderPlayer();

    }

  }



  function wallpaperMediaPlaybackListener(event) {

    if (!event) return;

    var M = window.wallpaperMediaIntegration;

    if (!M) return;

    if (event.state === M.PLAYBACK_PLAYING) {

      media.status = 'Playing';

      mediaTimeline.syncedAt = Date.now();

    } else if (event.state === M.PLAYBACK_PAUSED) {

      media.status = 'Paused';

      mediaTimeline.syncedAt = Date.now();

    } else {

      media.status = 'Stopped';

    }

    renderPlayer();

  }



  onUserPropertiesApplied = function () {

    rebuildCfgFromProps();

    weatherFetchedAt = 0;

    loadWeather();

    renderAll();

  };



  window.addEventListener('resize', scheduleFit);



  rebuildCfgFromProps();

  syncWeatherFromProps();

  initLogoBars();

  renderAll();

  loadStats();

  loadWeather();

  setInterval(loadStats, cfg.statsPollMs || 1500);

  setInterval(loadWeather, 20 * 60 * 1000);

  setInterval(function () {

    renderClocks();

    renderTimers();

    renderNetdate();

    updatePanelStale();

    updatePlayerTimeEl();

  }, 1000);



  if (typeof window.wallpaperRegisterAudioListener === 'function') {

    window.wallpaperRegisterAudioListener(wallpaperAudioListener);

  }



  if (typeof window.wallpaperRegisterMediaPropertiesListener === 'function') {

    window.wallpaperRegisterMediaPropertiesListener(wallpaperMediaPropertiesListener);

  }



  if (typeof window.wallpaperRegisterMediaTimelineListener === 'function') {

    window.wallpaperRegisterMediaTimelineListener(wallpaperMediaTimelineListener);

  }



  if (typeof window.wallpaperRegisterMediaPlaybackListener === 'function') {

    window.wallpaperRegisterMediaPlaybackListener(wallpaperMediaPlaybackListener);

  }

})();


