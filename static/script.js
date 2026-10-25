const HISTORY_KEY = "chatHistory";
const LANG_KEY = "chatLang";

const i18n = {
  tr: {
    tagline: "Geleneksel lezzetler, modern sunum",
    footer: "Barışın Restoranı — sorularınız için sağ alttaki asistanı kullanabilirsiniz.",
    chatBrand: "Barışın Restoranı Asistanı",
    placeholder: "Bir mesaj yazın...",
    send: "Gönder",
    empty: "Menümüz hakkında soru sorarak başlayın.",
    typing: "Yazıyor...",
    error: "Bir hata oluştu. Ollama sunucusunun çalıştığından emin olun.",
    menuLoading: "Menü yükleniyor...",
    menuError: "Menü yüklenemedi. Sunucunun çalıştığından emin olun.",
    available: "Mevcut",
    unavailable: "Tükendi",
    veg: "Vejetaryen",
    spicy: "Acılı",
    widgetOpenLabel: "Sohbeti aç",
    widgetCloseLabel: "Sohbeti kapat",
    clearTitle: "Temizle",
    closeTitle: "Kapat",
  },
  en: {
    tagline: "Traditional flavors, modern presentation",
    footer: "Barışın Restoranı — use the assistant in the bottom right for any questions.",
    chatBrand: "Barışın Restoranı Assistant",
    placeholder: "Type a message...",
    send: "Send",
    empty: "Start by asking a question about our menu.",
    typing: "Typing...",
    error: "Something went wrong. Make sure the Ollama server is running.",
    menuLoading: "Loading menu...",
    menuError: "Could not load the menu. Make sure the server is running.",
    available: "Available",
    unavailable: "Sold out",
    veg: "Vegetarian",
    spicy: "Spicy",
    widgetOpenLabel: "Open chat",
    widgetCloseLabel: "Close chat",
    clearTitle: "Clear",
    closeTitle: "Close",
  },
};

const siteTitle = document.getElementById("siteTitle");
const siteTagline = document.getElementById("siteTagline");
const footerText = document.getElementById("footerText");
const menuContainer = document.getElementById("menuContainer");
const langToggle = document.getElementById("langToggle");

const chatBrand = document.getElementById("chatBrand");
const chatWindow = document.getElementById("chatWindow");
const emptyState = document.getElementById("emptyState");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const emptyText = document.getElementById("emptyText");

const chatPanel = document.getElementById("chatPanel");
const widgetToggle = document.getElementById("widgetToggle");
const widgetToggleIcon = document.getElementById("widgetToggleIcon");
const widgetClose = document.getElementById("widgetClose");

let lang = sessionStorage.getItem(LANG_KEY) || "tr";
let menuData = null;
let widgetOpen = false;

function getHistory() {
  const raw = sessionStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveHistory(history) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function applyLangUI() {
  const t = i18n[lang];
  document.documentElement.lang = lang;
  siteTagline.textContent = t.tagline;
  footerText.textContent = t.footer;
  chatBrand.textContent = t.chatBrand;
  messageInput.placeholder = t.placeholder;
  sendBtn.textContent = t.send;
  emptyText.textContent = t.empty;
  clearBtn.title = t.clearTitle;
  widgetClose.title = t.closeTitle;
  widgetToggle.setAttribute("aria-label", widgetOpen ? t.widgetCloseLabel : t.widgetOpenLabel);

  document.querySelectorAll(".lang-option").forEach((el) => {
    el.classList.toggle("active", el.dataset.lang === lang);
  });

  renderMenu();
}

function formatPrice(price) {
  const rounded = Number.isInteger(price) ? price : price.toFixed(2);
  return `${rounded} ₺`;
}

async function fetchMenu() {
  if (menuData) return menuData;
  const res = await fetch("/api/menu");
  if (!res.ok) throw new Error("menu fetch failed");
  menuData = await res.json();
  return menuData;
}

async function renderMenu() {
  const t = i18n[lang];
  try {
    const items = await fetchMenu();
    const categories = new Map();
    items.forEach((item) => {
      const cat = lang === "tr" ? item.category : item.category_en;
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat).push(item);
    });

    menuContainer.innerHTML = "";
    categories.forEach((catItems, catName) => {
      const section = document.createElement("section");
      section.className = "menu-category";

      const title = document.createElement("h2");
      title.className = "menu-category-title";
      title.textContent = catName;
      section.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "menu-grid";

      catItems.forEach((item) => {
        const card = document.createElement("article");
        card.className = "menu-card" + (item.available ? "" : " unavailable");

        if (item.image) {
          const img = document.createElement("img");
          img.className = "menu-card-image";
          img.src = `/static/images/${item.image}`;
          img.alt = item.name;
          img.loading = "lazy";
          img.onerror = () => img.remove();
          card.appendChild(img);
        }

        const top = document.createElement("div");
        top.className = "menu-card-top";

        const name = document.createElement("h3");
        name.className = "menu-card-name";
        name.textContent = item.name;

        const price = document.createElement("span");
        price.className = "menu-card-price";
        price.textContent = formatPrice(item.price);

        top.appendChild(name);
        top.appendChild(price);

        const desc = document.createElement("p");
        desc.className = "menu-card-desc";
        desc.textContent = lang === "tr" ? item.description_tr : item.description_en;

        const tags = document.createElement("div");
        tags.className = "menu-card-tags";

        const availTag = document.createElement("span");
        availTag.className = "tag " + (item.available ? "available" : "unavailable");
        availTag.textContent = item.available ? t.available : t.unavailable;
        tags.appendChild(availTag);

        if (item.vegetarian) {
          const vegTag = document.createElement("span");
          vegTag.className = "tag veg";
          vegTag.textContent = "🌱 " + t.veg;
          tags.appendChild(vegTag);
        }
        if (item.spicy) {
          const spicyTag = document.createElement("span");
          spicyTag.className = "tag spicy";
          spicyTag.textContent = "🌶️ " + t.spicy;
          tags.appendChild(spicyTag);
        }

        card.appendChild(top);
        card.appendChild(desc);
        card.appendChild(tags);
        grid.appendChild(card);
      });

      section.appendChild(grid);
      menuContainer.appendChild(section);
    });
  } catch (err) {
    menuContainer.innerHTML = `<p class="menu-loading">${t.menuError}</p>`;
  }
}

function renderHistory() {
  const history = getHistory();
  chatWindow.innerHTML = "";
  history.forEach((msg) => appendBubble(msg.role, msg.content, false));
  emptyState.classList.toggle("hidden", history.length > 0);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function appendBubble(role, content, scroll = true) {
  const row = document.createElement("div");
  row.className = `bubble-row ${role}`;
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = content;
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  emptyState.classList.add("hidden");
  if (scroll) chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "bubble-row assistant";
  row.id = "typingRow";
  const bubble = document.createElement("div");
  bubble.className = "bubble assistant typing";
  bubble.textContent = i18n[lang].typing;
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function hideTyping() {
  const row = document.getElementById("typingRow");
  if (row) row.remove();
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  const history = getHistory();
  history.push({ role: "user", content: text });
  saveHistory(history);
  appendBubble("user", text);
  messageInput.value = "";
  sendBtn.disabled = true;
  showTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, lang }),
    });

    if (!res.ok) throw new Error("request failed");

    const data = await res.json();
    hideTyping();
    appendBubble("assistant", data.reply);

    const updated = getHistory();
    updated.push({ role: "assistant", content: data.reply });
    saveHistory(updated);
  } catch (err) {
    hideTyping();
    appendBubble("assistant", i18n[lang].error);
  } finally {
    sendBtn.disabled = false;
    messageInput.focus();
  }
}

function clearChat() {
  sessionStorage.removeItem(HISTORY_KEY);
  chatWindow.innerHTML = "";
  emptyState.classList.remove("hidden");
}

function toggleLang() {
  lang = lang === "tr" ? "en" : "tr";
  sessionStorage.setItem(LANG_KEY, lang);
  applyLangUI();
}

function openWidget() {
  widgetOpen = true;
  chatPanel.classList.remove("hidden");
  widgetToggleIcon.textContent = "✕";
  widgetToggle.setAttribute("aria-label", i18n[lang].widgetCloseLabel);
  messageInput.focus();
}

function closeWidget() {
  widgetOpen = false;
  chatPanel.classList.add("hidden");
  widgetToggleIcon.textContent = "💬";
  widgetToggle.setAttribute("aria-label", i18n[lang].widgetOpenLabel);
}

function toggleWidget() {
  if (widgetOpen) closeWidget();
  else openWidget();
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});
clearBtn.addEventListener("click", clearChat);
langToggle.addEventListener("click", toggleLang);
widgetToggle.addEventListener("click", toggleWidget);
widgetClose.addEventListener("click", closeWidget);

applyLangUI();
renderHistory();
