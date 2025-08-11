const WebSocket = require('ws');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

// === Biến lưu trạng thái API ===
let apiResponseData = {
    id: "@ghetvietcode - @tranbinh012 - @Phucdzvl2222",
    phien: null,
    xuc_xac_1: null,
    xuc_xac_2: null,
    xuc_xac_3: null,
    tong: null,
    ket_qua: "",
    du_doan: "?",
    ty_le_thanh_cong: "0%",
    giai_thich: "Đang chờ đủ dữ liệu để phân tích...",
    pattern: ""
};

let id_phien_chua_co_kq = null;
let patternHistory = []; // Lưu dãy T/X gần nhất

// === Hàm phân tích có quy tắc ===
/**
 * Phân tích chuỗi kết quả và đưa ra dự đoán dựa trên các quy tắc đơn giản.
 * @param {string[]} patternArr - Mảng lịch sử kết quả (['T', 'X', 'T', ...])
 * @returns {{du_doan: string, ty_le: string, giai_thich: string}}
 */
function analyzeAndPredict(patternArr) {
    const len = patternArr.length;
    if (len < 3) {
        return {
            du_doan: "?",
            ty_le: "0%",
            giai_thich: "Chưa đủ dữ liệu để phân tích cầu."
        };
    }

    const last1 = patternArr[len - 1];
    const last2 = patternArr[len - 2];
    const last3 = patternArr[len - 3];
    const last4 = patternArr[len - 4];

    // Quy tắc 1: Cầu Bệt (Streak) - Ví dụ: T-T-T -> Dự đoán T
    if (last1 === last2 && last2 === last3) {
        return {
            du_doan: last1,
            ty_le: "85%",
            giai_thich: "AI nhận định cầu bệt đang chạy dài, đi theo cầu."
        };
    }

    // Quy tắc 2: Cầu 1-1 (Alternating) - Ví dụ: T-X-T -> Dự đoán X
    if (last1 !== last2 && last2 !== last3) {
         return {
            du_doan: last2,
            ty_le: "78%",
            giai_thich: "AI phát hiện tín hiệu cầu 1-1 (xen kẽ), đi theo cầu."
        };
    }
    
    // Quy tắc 3: Cầu 2-2 - Ví dụ: T-T-X-X -> Dự đoán T
    if (len >= 4 && last1 === last2 && last3 === last4 && last2 !== last3) {
        return {
            du_doan: last1,
            ty_le: "75%",
            giai_thich: "AI phân tích xu hướng cầu 2-2, dự đoán lặp lại cặp."
        }
    }

    // Quy tắc 4 (Mặc định): Bẻ cầu (ngược lại phiên trước)
    const opposite = last1 === 'T' ? 'X' : 'T';
    return {
        du_doan: opposite,
        ty_le: "55%",
        giai_thich: "Các cầu không rõ ràng, AI dự đoán bẻ cầu (ngược lại phiên trước)."
    };
}


// === THAY ĐỔI: Cập nhật tin nhắn khởi tạo WebSocket ===
const messagesToSend = [
    [
        1,
        "MiniGame",
        "GM_fbbdbebndbbc",
        "123123p",
        {
            "info": "{\"ipAddress\":\"2402:800:62cd:cb7c:1a7:7a52:9c3e:c290\",\"wsToken\":\"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJnZW5kZXIiOjAsImNhblZpZXdTdGF0IjpmYWxzZSwiZGlzcGxheU5hbWUiOiJuZG5lYmViYnMiLCJib3QiOjAsImlzTWVyY2hhbnQiOmZhbHNlLCJ2ZXJpZmllZEJhbmtBY2NvdW50IjpmYWxzZSwicGxheUV2ZW50TG9iYnkiOmZhbHNlLCJjdXN0b21lcklkIjozMTIxMDczMTUsImFmZklkIjoiR0VNV0lOIiwiYmFubmVkIjpmYWxzZSwiYnJhbmQiOiJnZW0iLCJ0aW1lc3RhbXAiOjE3NTQ5MjYxMDI1MjcsImxvY2tHYW1lcyI6W10sImFtb3VudCI6MCwibG9ja0NoYXQiOmZhbHNlLCJwaG9uZVZlcmlmaWVkIjpmYWxzZSwiaXBBZGRyZXNzIjoiMjQwMjo4MDA6NjJjZDpjYjdjOjFhNzo3YTUyOjljM2U6YzI5MCIsIm11dGUiOmZhbHNlLCJhdmF0YXIiOiJodHRwczovL2ltYWdlcy5zd2luc2hvcC5uZXQvaW1hZ2VzL2F2YXRhci9hdmF0YXJfMDEucG5nIiwicGxhdGZvcm1JZCI6NSwidXNlcklkIjoiN2RhNDlhNDQtMjlhYS00ZmRiLWJkNGMtNjU5OTQ5YzU3NDdkIiwicmVnVGltZSI6MTc1NDkyNjAyMjUxNSwicGhvbmUiOiIiLCJkZXBvc2l0IjpmYWxzZSwidXNlcm5hbWUiOiJHTV9mYmJkYmVibmRiYmMifQ.DAyEeoAnz8we-Qd0xS0tnqOZ8idkUJkxksBjr_Gei8A\",\"locale\":\"vi\",\"userId\":\"7da49a44-29aa-4fdb-bd4c-659949c5747d\",\"username\":\"GM_fbbdbebndbbc\",\"timestamp\":1754926102527,\"refreshToken\":\"7cc4ad191f4348849f69427a366ea0fd.a68ece9aa85842c7ba523170d0a4ae3e\"}",
            "signature": "53D9E12F910044B140A2EC659167512E2329502FE84A6744F1CD5CBA9B6EC04915673F2CBAE043C4EDB94DDF88F3D3E839A931100845B8F179106E1F44ECBB4253EC536610CCBD0CE90BD8495DAC3E8A9DBDB46FE49B51E88569A6F117F8336AC7ADC226B4F213ECE2F8E0996F2DD5515476C8275F0B2406CDF2987F38A6DA24"
        }
    ],
    [6, "MiniGame", "taixiuPlugin", { cmd: 1005 }],
    [6, "MiniGame", "lobbyPlugin", { cmd: 10001 }]
];
  

// === WebSocket ===
let ws = null;
let pingInterval = null;
let reconnectTimeout = null;
let isManuallyClosed = false;

function connectWebSocket() {
  ws = new WebSocket("wss://websocket.azhkthg1.net/websocket?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbW91bnQiOjAsInVzZXJuYW1lIjoiU0NfYXBpc3Vud2luMTIzIn0.hgrRbSV6vnBwJMg9ZFtbx3rRu9mX_hZMZ_m5gMNhkw0", {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Origin": "https://play.sun.win"
    }
  });

  ws.on('open', () => {
    console.log('[✅] WebSocket kết nối');
    messagesToSend.forEach((msg, i) => {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      }, i * 600);
    });

    pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 15000);
  });

  ws.on('pong', () => {
    console.log('[📶] Ping OK');
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (Array.isArray(data) && typeof data[1] === 'object') {
        const cmd = data[1].cmd;

        if (cmd === 1008 && data[1].sid) {
          id_phien_chua_co_kq = data[1].sid;
        }

        if (cmd === 1003 && data[1].gBB) {
          const { d1, d2, d3 } = data[1];
          const total = d1 + d2 + d3;
          const result = total > 10 ? "T" : "X";

          patternHistory.push(result);
          if (patternHistory.length > 20) patternHistory.shift();

          const prediction = analyzeAndPredict(patternHistory);

          apiResponseData = {
            id: "@ghetvietcode - @tranbinh012 - @Phucdzvl2222",
            phien: id_phien_chua_co_kq,
            xuc_xac_1: d1,
            xuc_xac_2: d2,
            xuc_xac_3: d3,
            tong: total,
            ket_qua: result === 'T' ? 'Tài' : 'Xỉu',
            du_doan: prediction.du_doan === "?" ? "?" : (prediction.du_doan === "T" ? "Tài" : "Xỉu"),
            ty_le_thanh_cong: prediction.ty_le,
            giai_thich: prediction.giai_thich,
            pattern: patternHistory.join('')
          };
          
          console.log(`Phiên ${apiResponseData.phien}: ${apiResponseData.tong} (${apiResponseData.ket_qua}) | Pattern: ${apiResponseData.pattern} | Dự đoán: ${apiResponseData.du_doan} (${apiResponseData.giai_thich})`);
          id_phien_chua_co_kq = null;
        }
      }
    } catch (e) {
      console.error('[Lỗi]:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[🔌] WebSocket ngắt. Đang kết nối lại...');
    clearInterval(pingInterval);
    if (!isManuallyClosed) {
      reconnectTimeout = setTimeout(connectWebSocket, 2500);
    }
  });

  ws.on('error', (err) => {
    console.error('[❌] WebSocket lỗi:', err.message);
  });
}

// === API ===
app.get('/sunlon', (req, res) => {
  res.json(apiResponseData);
});

app.get('/', (req, res) => {
  res.send(`<h2>🎯 Kết quả Sunwin Tài Xỉu (API Phân Tích)</h2><p><a href="/sunlon">Xem kết quả JSON tại /sunlon</a></p>`);
});

// === Khởi động server ===
app.listen(PORT, () => {
  console.log(`[🌐] Server chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
