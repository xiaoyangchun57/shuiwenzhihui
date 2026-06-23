/**
 * 水利运维智慧运营平台 - 一张图驾驶舱
 */

const API = 'http://localhost:5000/api';
let charts = {};

// ===================== Time =====================
function updateTime() {
    const now = new Date();
    const str = now.toLocaleDateString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit'}) + ' ' +
                now.toLocaleTimeString('zh-CN', {hour12:false});
    document.getElementById('header-time').textContent = str;
}
setInterval(updateTime, 1000);
updateTime();

// ===================== Data Fetch =====================
async function api_fetch(url) {
    try { const r = await fetch(`${API}${url}`); return await r.json(); }
    catch(e) { console.error(e); return null; }
}

// ===================== Map Markers =====================
async function renderMapSites() {
    const sites = await api_fetch('/data/realtime');
    if (!sites) return;
    const container = document.getElementById('map-container');
    // 清除旧标记（保留河流线）
    container.querySelectorAll('.map-marker,.map-popup').forEach(el => el.remove());

    // 移除旧popup
    const oldPopup = document.querySelector('.map-popup');
    if (oldPopup) oldPopup.remove();

    const positions = [
        {x:25,y:28}, // 青山水库
        {x:45,y:22}, // 梅湖水库
        {x:38,y:35}, // 城北水闸
        {x:55,y:30}, // 滨江堤防A段
        {x:68,y:32}, // 滨江堤防B段
        {x:60,y:25}, // 新城泵站
        {x:72,y:20}, // 工业园区泵站
        {x:35,y:18}, // 河东泵站
        {x:78,y:45}, // 丰收灌区
        {x:50,y:40}, // 城南供水站
    ];

    sites.forEach((s, i) => {
        const pos = positions[i] || positions[0];
        let dotClass = 'green';
        if (s.latest_metric) {
            if ((s.latest_metric === 'turbidity' && s.latest_value > 0.4) ||
                (s.latest_metric === 'displacement' && s.latest_value > 10) ||
                (s.latest_metric === 'vibration' && s.latest_value > 7)) {
                dotClass = 'red';
            } else if ((s.latest_metric === 'water_level' && s.latest_value > 49)) {
                dotClass = 'orange';
            }
        }
        if (s.status === 'offline') dotClass = 'green'; // still visible but dimmer would be nice

        const marker = document.createElement('div');
        marker.className = 'map-marker';
        marker.style.cssText = `left:${pos.x}%;top:${pos.y}%`;
        marker.innerHTML = `<div class="dot ${dotClass}"></div><div class="ripple ${dotClass}"></div>
            <div class="map-label">${s.name} ${s.latest_value}${s.latest_unit||''}</div>`;
        marker.onclick = (e) => {
            e.stopPropagation();
            showMapPopup(s, pos, i, e);
        };
        container.appendChild(marker);
    });
}

function showMapPopup(site, pos, idx, e) {
    const oldPopup = document.querySelector('.map-popup');
    if (oldPopup) oldPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'map-popup active';
    // Position near click
    const x = (pos.x - 5) + '%';
    const y = (pos.y + 5) + '%';

    api_fetch(`/sites/${site.id}`).then(detail => {
        const devices = detail ? detail.devices || [] : [];
        const devHtml = devices.slice(0,4).map(d => {
            const sColor = d.status === 'online' ? '#2ed573' : '#7fa9d4';
            return `<div class="popup-row"><span class="lbl">${d.device_name}</span><span class="val" style="color:${sColor}">${d.status}</span></div>`;
        }).join('');

        popup.innerHTML = `
            <div class="popup-hd"><span>${site.name} (${site.code})</span><span class="popup-close" onclick="this.closest('.map-popup').remove()">✕</span></div>
            <div class="popup-bd">
                <div class="popup-row"><span class="lbl">类型</span><span class="val">${site.type}</span></div>
                <div class="popup-row"><span class="lbl">最新数据</span><span class="val">${site.latest_value} ${site.latest_unit||''}</span></div>
                <div class="popup-row"><span class="lbl">更新时间</span><span class="val" style="font-size:11px">${site.latest_time||'-'}</span></div>
                <div class="popup-row"><span class="lbl">负责人</span><span class="val">${site.manager||'-'}</span></div>
                ${detail ? `
                <div class="popup-row"><span class="lbl">活跃告警</span><span class="val" style="color:#ff4757">${detail.active_alerts||0}</span></div>
                <div class="popup-row"><span class="lbl">进行中工单</span><span class="val" style="color:#ffa502">${detail.open_orders||0}</span></div>` : ''}
                <div style="margin-top:6px;padding-top:6px;border-top:1px solid #1a4a7a;font-size:11px;color:#5a8ab5">设备清单</div>
                ${devHtml || '<div class="popup-row"><span class="lbl" style="color:#5a8ab5">暂无设备数据</span></div>'}
            </div>`;
    });

    popup.style.cssText = `position:absolute;left:${x};top:${y};z-index:30`;

    // Convert percentage to px for popup
    const container = document.getElementById('map-container');
    const rect = container.getBoundingClientRect();
    const px = (rect.width * pos.x / 100) + 30;
    const py = (rect.height * pos.y / 100) - 50;
    popup.style.left = px + 'px';
    popup.style.top = Math.max(10, py) + 'px';

    container.appendChild(popup);
}

// ===================== Site Data Feed =====================
async function loadSiteFeed() {
    const sites = await api_fetch('/data/realtime');
    if (!sites) return;
    let html = '';
    sites.slice(0, 8).forEach(s => {
        const dotColor = s.status === 'offline' ? '#7fa9d4' :
            (s.latest_metric && (s.latest_metric === 'turbidity' || s.latest_metric === 'displacement' || s.latest_metric === 'vibration') && s.latest_value > 5) ? '#ff4757' : '#2ed573';
        html += `<div class="dl-item">
            <span class="dl-dot" style="background:${dotColor}"></span>
            <span class="dl-info">
                <div class="dl-title">${s.name}</div>
                <div class="dl-sub">${s.type} | ${s.manager||''}</div>
            </span>
            <span class="dl-val">${s.latest_value} ${s.latest_unit||''}</span>
        </div>`;
    });
    document.getElementById('site-data-feed').innerHTML = html;
}

// ===================== Alert Feed =====================
async function loadAlertFeed() {
    const alerts = await api_fetch('/alerts?limit=20');
    if (!alerts || alerts.length === 0) {
        document.getElementById('alert-feed').innerHTML = '<div style="color:#5a8ab5;text-align:center;padding:20px">✓ 当前无活跃告警</div>';
        document.getElementById('alert-count-badge').textContent = '';
        updateHeaderAlertCount(0);
        return;
    }
    const pendingAlerts = alerts.filter(a => a.status === 'pending');
    updateHeaderAlertCount(pendingAlerts.length);
    document.getElementById('alert-count-badge').textContent = pendingAlerts.length > 0 ? `共${pendingAlerts.length}条` : '';

    let html = '';
    alerts.filter(a => a.status === 'pending').slice(0, 8).forEach(a => {
        html += `<div class="alert-row">
            <span class="alert-level ${a.level}">${a.level==='red'?'红':a.level==='orange'?'橙':a.level==='yellow'?'黄':'蓝'}</span>
            <span class="alert-msg">${a.site_name}: ${a.message}</span>
            <span class="alert-time">${a.created_at.substring(11,16)}</span>
        </div>`;
    });
    document.getElementById('alert-feed').innerHTML = html || '<div style="color:#5a8ab5;text-align:center;padding:20px">暂无活跃告警</div>';

    // 底部滚动
    if (pendingAlerts.length > 0) {
        const ticker = pendingAlerts.map(a => `[${a.level==='red'?'红色警报':a.level==='orange'?'橙色预警':'黄色警示'}] ${a.site_name}: ${a.message}`).join(' ｜ ');
        document.getElementById('bottom-ticker').textContent = ticker;
    }
}

function updateHeaderAlertCount(count) {
    document.getElementById('h-alerts').textContent = count;
    document.getElementById('h-alerts').style.color = count > 0 ? '#ff4757' : '#00d4ff';
}

// ===================== Charts =====================

// Device status pie
async function loadDeviceChart() {
    const overview = await api_fetch('/data/overview');
    if (!overview) return;
    document.getElementById('dev-on').textContent = overview.device_online;
    document.getElementById('dev-off').textContent = overview.device_total - overview.device_online;
    document.getElementById('dev-low').textContent = Math.floor(Math.random() * 2);

    const ctx = document.getElementById('chart-device').getContext('2d');
    if (charts.device) charts.device.destroy();
    charts.device = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['在线', '离线', '低电量'],
            datasets: [{
                data: [overview.device_online, overview.device_total - overview.device_online, 1],
                backgroundColor: ['rgba(46,213,115,0.7)', 'rgba(127,169,212,0.3)', 'rgba(255,165,2,0.5)'],
                borderColor: ['#2ed573', '#3a5a8a', '#ffa502'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: 'rgba(0,20,60,0.95)', borderColor: '#2a5a9a', borderWidth: 1 }
            }
        }
    });
}

// Water level chart
async function loadWaterLevelChart() {
    // 取青山水库最近数据
    const data = await api_fetch('/data/site/1?limit=24');
    if (!data || data.length === 0) return;
    const waterData = data.filter(d => d.metric === 'water_level' || d.metric.includes('water')).reverse();

    const labels = waterData.map(d => d.recorded_at.substring(11,16));
    const values = waterData.map(d => d.value);

    const ctx = document.getElementById('chart-waterlevel').getContext('2d');
    if (charts.waterlevel) charts.waterlevel.destroy();
    charts.waterlevel = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: '库水位(m)', data: values, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.05)',
                  borderWidth: 1.5, fill: true, pointRadius: 0, tension: 0.3 },
                { label: '警戒线', data: Array(labels.length).fill(50.0), borderColor: '#ffa502',
                  borderWidth: 1, borderDash: [5,5], pointRadius: 0, fill: false },
                { label: '危急线', data: Array(labels.length).fill(51.5), borderColor: '#ff4757',
                  borderWidth: 1, borderDash: [5,5], pointRadius: 0, fill: false },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#7fa9d4', font: { size: 10 }, boxWidth: 12 } } },
            scales: {
                x: { ticks: { color: '#5a8ab5', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: 'rgba(26,58,106,0.3)' } },
                y: { ticks: { color: '#5a8ab5', font: { size: 9 } }, grid: { color: 'rgba(26,58,106,0.3)' }, min: 42, max: 54 }
            }
        }
    });
}

// Work order status bar chart
async function loadOrderChart() {
    const stats = await api_fetch('/workorders/statistics');
    if (!stats) return;
    document.getElementById('today-new').textContent = stats.today_new || 0;
    document.getElementById('today-closed').textContent = stats.today_closed || 0;

    const statusOrder = ['pending','accepted','generated','dispatched','in_progress','reviewing','acceptance','closed'];
    const statusLabels = ['待受理','已受理','工单生成','已派发','处置中','待审核','待验收','已关闭'];
    const colors = ['#5a8ab5','#00d4ff','#7c5ce7','#ffa502','#2ed573','#00d4ff','#ffa502','#5a8ab5'];
    const counts = statusOrder.map(s => stats.by_status?.[s] || 0);

    const ctx = document.getElementById('chart-orders').getContext('2d');
    if (charts.orders) charts.orders.destroy();
    charts.orders = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: statusLabels,
            datasets: [{ data: counts, backgroundColor: colors.map(c => c.replace(')',').replace('rgba','rgba').replace(/[^,]+(?=\))/,'0.6')), borderColor: colors, borderWidth: 1, borderRadius: 2 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#5a8ab5', font: { size: 9 } }, grid: { display: false } },
                y: { ticks: { color: '#5a8ab5', font: { size: 9 }, stepSize: 1 }, grid: { color: 'rgba(26,58,106,0.3)' } }
            }
        }
    });

    // Update header
    const openCount = counts.slice(0, 7).reduce((a,b) => a+b, 0);
    document.getElementById('h-orders').textContent = openCount;
    document.getElementById('h-orders').style.color = openCount > 0 ? '#ffa502' : '#00d4ff';
}

// Hotline feed
async function loadHotlineFeed() {
    const events = await api_fetch('/hotline/events?limit=5');
    if (!events || events.length === 0) {
        document.getElementById('hotline-feed').innerHTML = '<div style="color:#5a8ab5;text-align:center;padding:10px">暂无热线记录</div>';
        return;
    }
    let html = '';
    events.forEach(e => {
        const sColor = e.status === 'dispatched' ? '#2ed573' : '#5a8ab5';
        html += `<div class="dl-item">
            <span class="dl-dot" style="background:${sColor}"></span>
            <span class="dl-info">
                <div class="dl-title">${e.caller_name||'匿名'} - ${e.event_type}</div>
                <div class="dl-sub">${e.location||''} | ${e.operator}</div>
            </span>
            <span class="dl-val" style="font-size:10px;color:#5a8ab5">${e.created_at.substring(11,16)}</span>
        </div>`;
    });
    document.getElementById('hotline-feed').innerHTML = html;
}

// Header stats
async function loadHeaderStats() {
    const overview = await api_fetch('/data/overview');
    if (!overview) return;
    document.getElementById('h-sites').textContent = overview.online_sites;
    document.getElementById('h-devices').textContent = overview.device_online;
    document.getElementById('ls-total').textContent = overview.total_sites;
    document.getElementById('ls-online').textContent = overview.online_sites;
    document.getElementById('ls-alert').textContent = overview.active_alerts || 0;
    if ((overview.active_alerts || 0) > 0) {
        document.getElementById('ls-alert').className = 'num warn';
    }
}

// ===================== Main Loop =====================
async function refreshAll() {
    await Promise.all([
        loadHeaderStats(),
        loadSiteFeed(),
        loadAlertFeed(),
        loadDeviceChart(),
        loadWaterLevelChart(),
        loadOrderChart(),
        loadHotlineFeed(),
        renderMapSites(),
    ]);
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString('zh-CN', {hour12:false});
}

// Initial load
refreshAll();
setInterval(refreshAll, 15000);
