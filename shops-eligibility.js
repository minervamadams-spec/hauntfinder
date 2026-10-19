(function () {
  'use strict';

  function isHttps(url) {
    return /^https:\/\//i.test(String(url || ''));
  }

  function today() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  }

  function isActive(ad, date) {
    var currentDate = date || today();
    return !!ad && ad.status === 'approved' && isHttps(ad.url) &&
      (!ad.startDate || ad.startDate <= currentDate) &&
      (!ad.expirationDate || ad.expirationDate >= currentDate);
  }

  var api = { isActive: isActive, isHttps: isHttps, today: today };
  if (typeof window !== 'undefined') window.HauntfinderShopsEligibility = api;
  if (typeof module !== 'undefined') module.exports = api;
}());
