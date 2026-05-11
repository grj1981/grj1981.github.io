'use strict';

(function() {
  function fetchData() {
    var statsEl = document.getElementById('dash-stats');
    if (!statsEl) return;
    fetch('/fish/dashboard/data.json')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        renderStats(data);
        renderYearlyChart(data);
        renderSpeciesChart(data);
      })
      .catch(function() {
        statsEl.innerHTML =
          '<p style="text-align:center;color:#999;padding:40px;">数据加载失败 🐟</p>';
      });
  }

  function renderStats(data) {
    document.getElementById('total-photos').textContent = data.totalPhotos;
    document.getElementById('total-years').textContent = data.totalYears;
    document.getElementById('avg-yearly').textContent =
      (data.totalPhotos / data.totalYears).toFixed(1);
    var best = data.yearlyData.reduce(function(a, b) {
      return a.count > b.count ? a : b;
    });
    document.getElementById('best-year').textContent = best.year;
  }

  function renderYearlyChart(data) {
    var ctx = document.getElementById('yearlyChart');
    if (!ctx) return;
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.yearlyData.map(function(d) { return d.year; }),
        datasets: [{
          label: '鱼获照片数',
          data: data.yearlyData.map(function(d) { return d.count; }),
          backgroundColor: 'rgba(55, 198, 192, 0.6)',
          borderColor: '#37c6c0',
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: '历年鱼获数量趋势', font: { size: 16 } }
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: '照片数' } },
          x: { title: { display: true, text: '年份' } }
        }
      }
    });
  }

  function renderSpeciesChart(data) {
    var ctx = document.getElementById('speciesChart');
    if (!ctx) return;
    var labels = [];
    var values = [];
    Object.keys(data.speciesStats).forEach(function(key) {
      if (data.speciesStats[key] > 0) {
        labels.push(key);
        values.push(data.speciesStats[key]);
      }
    });
    var colors = ['#37c6c0', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c9c9c9', '#f0a050', '#a855f7', '#66d9e8', '#e879f9'];
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: '鱼种分布', font: { size: 16 } },
          legend: { position: 'bottom' }
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchData);
  } else {
    fetchData();
  }
})();
