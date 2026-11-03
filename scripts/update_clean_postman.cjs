const fs = require('fs');

const filePaths = [
  'C:/HRMS backend/HRMS_Software_Website/Paneliya_HRMS_API.postman_collection.json',
  'C:/HRMS backend/HRMS_Software_Website/postman/collections/Paneliya_HRMS_API.postman_collection.json'
];

filePaths.forEach(fp => {
  if (!fs.existsSync(fp)) return;
  const col = JSON.parse(fs.readFileSync(fp, 'utf8'));

  function updateItems(items) {
    for (const it of items) {
      if (it.item) {
        updateItems(it.item);
      } else {
        const urlRaw = it.request?.url?.raw || '';
        if (urlRaw.includes('/attendance/work/start') && it.request?.body) {
          it.name = it.name.replace(' (Selfie & GPS)', '');
          it.request.body = {
            mode: 'raw',
            raw: '{\n  "deviceInfo": "Web Browser"\n}',
            options: { raw: { language: 'json' } }
          };
        }
        if (urlRaw.includes('/attendance/work/stop') && it.request?.body) {
          it.name = it.name.replace(' (Selfie & GPS)', '');
          it.request.body = {
            mode: 'raw',
            raw: '{\n  "remarks": "Shift completed"\n}',
            options: { raw: { language: 'json' } }
          };
        }
        if (urlRaw.includes('/attendance/work/break/start') && (!it.request?.body || !it.request.body.raw)) {
          it.request.body = {
            mode: 'raw',
            raw: '{}',
            options: { raw: { language: 'json' } }
          };
        }
        if (urlRaw.includes('/attendance/work/break/resume') && (!it.request?.body || !it.request.body.raw)) {
          it.request.body = {
            mode: 'raw',
            raw: '{}',
            options: { raw: { language: 'json' } }
          };
        }
      }
    }
  }

  updateItems(col.item);
  fs.writeFileSync(fp, JSON.stringify(col, null, 2), 'utf8');
  console.log('Successfully updated:', fp);
});

