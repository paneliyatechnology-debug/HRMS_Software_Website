const fs = require('fs');

const breakItems = [
  {
    name: "Take a Break (Start Break)",
    request: {
      method: "POST",
      header: [
        {
          key: "Accept",
          value: "application/json",
          type: "text"
        },
        {
          key: "Authorization",
          value: "Bearer {{authToken}}",
          type: "text"
        }
      ],
      url: {
        raw: "{{baseUrl}}/attendance/work/break/start",
        host: ["{{baseUrl}}"],
        path: ["attendance", "work", "break", "start"],
        query: [],
        variable: []
      },
      description: "Pauses active work timer and starts break timer for the authenticated employee."
    },
    response: []
  },
  {
    name: "Resume Work from Break",
    request: {
      method: "POST",
      header: [
        {
          key: "Accept",
          value: "application/json",
          type: "text"
        },
        {
          key: "Authorization",
          value: "Bearer {{authToken}}",
          type: "text"
        }
      ],
      url: {
        raw: "{{baseUrl}}/attendance/work/break/resume",
        host: ["{{baseUrl}}"],
        path: ["attendance", "work", "break", "resume"],
        query: [],
        variable: []
      },
      description: "Concludes active break, records break duration, and resumes active work session."
    },
    response: []
  }
];

function updateCollection(filePath) {
  if (!fs.existsSync(filePath)) return;
  const col = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  function findAndInsert(items) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.name && item.name.toLowerCase().includes('stop active employee work') || (item.request && item.request.url && (item.request.url.raw || '').includes('attendance/work/stop'))) {
        // Check if not already inserted
        const alreadyExists = items.some(it => it.name === 'Take a Break (Start Break)');
        if (!alreadyExists) {
          items.splice(i + 1, 0, ...breakItems);
          console.log(`Inserted break items into ${filePath}`);
          return true;
        }
      }
      if (item.item && Array.isArray(item.item)) {
        if (findAndInsert(item.item)) return true;
      }
    }
    return false;
  }

  findAndInsert(col.item);
  fs.writeFileSync(filePath, JSON.stringify(col, null, 2), 'utf8');
}

updateCollection('C:/HRMS backend/HRMS_Software_Website/Paneliya_HRMS_API.postman_collection.json');
updateCollection('C:/HRMS backend/HRMS_Software_Website/postman/collections/Paneliya_HRMS_API.postman_collection.json');
console.log('Postman collections updated.');

