const http = require("http");

const makeRequest = (ip, apiKey, path, method = "GET", body = null) => {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: ip,
        port: 80,
        path: `/api/${apiKey}${path}`,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
};

const getLights = (ip, apiKey) => makeRequest(ip, apiKey, "/lights");
const getGroups = (ip, apiKey) => makeRequest(ip, apiKey, "/groups");
const getScenes = (ip, apiKey) => makeRequest(ip, apiKey, "/scenes");
const setLightState = (ip, apiKey, lightId, state) =>
  makeRequest(ip, apiKey, `/lights/${lightId}/state`, "PUT", state);
const setGroupAction = (ip, apiKey, groupId, action) =>
  makeRequest(ip, apiKey, `/groups/${groupId}/action`, "PUT", action);
const activateScene = (ip, apiKey, groupId, sceneId) =>
  makeRequest(ip, apiKey, `/groups/${groupId}/action`, "PUT", { scene: sceneId });

module.exports = { getLights, getGroups, getScenes, setLightState, setGroupAction, activateScene };
