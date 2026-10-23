(() => {
  "use strict";

  const STORAGE_KEY = "myMoneyTransactions_v1";
  const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  let transactions = loadTransactions();
  let selectedType = "expense";
  let selectedPeriod = "day";

  const icons = {
    "ອາຫານ": "🍜", "ເດີນທາງ": "🛵", "ກາເຟ/ເຄື່ອງດື່ມ": "☕",
    "ຊື້ເຄື່ອງ": "🛍️", "ຄ່າບ້ານ": "🏠", "ເງິນເດືອນ": "💼",
    "ທຸລະກິດ": "💰", "ອື່ນໆ": "📌"
  };

  function loadTransactions() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data.filter(isValidTransaction) : [];
    } catch (error) {
      console.warn("Could not load My Money data:", error);
      return [];
    }
  }

  function isValidTransaction(item) {
    return item && typeof item.id === "string" &&
      (item.type === "income" || item.type === "expense") &&
      Number.isFinite(Number(item.amount)) && Number(item.amount) > 0 &&
      typeof item.date === "string";
  }

  function saveTransactions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
      return true;
    } catch (error) {
      alert("ບັນທຶກບໍ່ສຳເລັດ. ກະລຸນາກວດພື້ນທີ່ວ່າງຂອງ Browser.");
      console.error(error);
      return false;
    }
  }

  function formatMoney(amount) {
    return "₭ " + money.format(Math.round(Number(amount) || 0));
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function dateFromInput(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function formatDate(dateString, withTime = true) {
    const date = dateString instanceof Date ? dateString : new Date(dateString);
    if (Number.isNaN(date.getTime())) return "ບໍ່ຮູ້ວັນທີ";
    const datePart = new Intl.DateTimeFormat("lo-LA", { day: "2-digit", month: "short", year: "numeric" }).format(date);
    if (!withTime) return datePart;
    const timePart = new Intl.DateTimeFormat("lo-LA", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
    return `${datePart} · ${timePart}`;
  }

  function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function getPeriodBounds(period) {
    const now = new Date();
    const start = startOfDay(now);
    let end = new Date(start);
    if (period === "week") {
      const weekday = (start.getDay() + 6) % 7; // Monday is first day
      start.setDate(start.getDate() - weekday);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
    } else if (period === "month") {
      start.setDate(1);
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setDate(end.getDate() + 1);
    }
    return { start, end };
  }

  function inPeriod(transaction, bounds) {
    const date = new Date(transaction.date);
    return date >= bounds.start && date < bounds.end;
  }

  function totals(items) {
    return items.reduce((result, item) => {
      if (item.type === "income") result.income += Number(item.amount);
      else result.expense += Number(item.amount);
      result.net = result.income - result.expense;
      return result;
    }, { income: 0, expense: 0, net: 0 });
  }

  function renderBalance() {
    const result = totals(transactions);
    $("#totalBalance").textContent = formatMoney(result.net);
    $("#totalIncome").textContent = formatMoney(result.income);
    $("#totalExpense").textContent = formatMoney(result.expense);
  }

  function renderReport() {
    const bounds = getPeriodBounds(selectedPeriod);
    const items = transactions.filter(item => inPeriod(item, bounds));
    const result = totals(items);
    $("#periodIncome").textContent = formatMoney(result.income);
    $("#periodExpense").textContent = formatMoney(result.expense);
    $("#periodNet").textContent = formatMoney(result.net);
    $("#periodNet").classList.toggle("positive", result.net >= 0);
    $("#periodNet").classList.toggle("negative", result.net < 0);

    const endForLabel = new Date(bounds.end.getTime() - 1);
    if (selectedPeriod === "day") {
      $("#reportRange").textContent = formatDate(bounds.start, false);
    } else {
      $("#reportRange").textContent = `${formatDate(bounds.start, false)} – ${formatDate(endForLabel, false)}`;
    }

    const expenses = items.filter(item => item.type === "expense");
    const byCategory = {};
    expenses.forEach(item => {
      const key = item.category || "ອື່ນໆ";
      byCategory[key] = (byCategory[key] || 0) + Number(item.amount);
    });
    const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const max = rows.length ? rows[0][1] : 0;
    const container = $("#categoryBreakdown");
    if (!rows.length) {
      container.innerHTML = '<p class="empty-small">ຍັງບໍ່ມີລາຍຈ່າຍໃນຊ່ວງນີ້</p>';
      return;
    }
    container.innerHTML = rows.map(([category, amount]) => `
      <div class="category-row">
        <span class="category-name">${escapeHTML(icons[category] || "📌")} ${escapeHTML(category)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(2, amount / max * 100)}%"></div></div>
        <span class="category-value">${money.format(amount)}</span>
      </div>`).join("");
  }

  function renderTransactions() {
    const filter = $("#historyFilter").value;
    const items = [...transactions]
      .filter(item => filter === "all" || item.type === filter)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    $("#historyCount").textContent = `${items.length} ລາຍການ`;
    const container = $("#transactionList");
    if (!items.length) {
      container.innerHTML = '<div class="empty-state"><span>🧾</span>ຍັງບໍ່ມີລາຍການ<br><small>ເລີ່ມບັນທຶກດ້ວຍປຸ່ມຈຳນວນເງິນຂ້າງເທິງ</small></div>';
      return;
    }
    container.innerHTML = items.map(item => {
      const isIncome = item.type === "income";
      const title = item.note?.trim() || item.category || "ອື່ນໆ";
      const amount = `${isIncome ? "+" : "−"}${formatMoney(item.amount)}`;
      return `
        <article class="transaction">
          <div class="transaction-icon ${item.type}">${escapeHTML(icons[item.category] || (isIncome ? "💵" : "📌"))}</div>
          <div class="transaction-main">
            <div class="transaction-title">${escapeHTML(title)}</div>
            <div class="transaction-meta">${escapeHTML(item.category || "ອື່ນໆ")} · ${escapeHTML(formatDate(item.date))}</div>
          </div>
          <div class="transaction-right">
            <div class="transaction-amount ${item.type}">${amount}</div>
            <div class="transaction-actions">
              <button type="button" class="mini-btn" data-edit="${escapeHTML(item.id)}">ແກ້ໄຂ</button>
              <button type="button" class="mini-btn delete" data-delete="${escapeHTML(item.id)}">ລຶບ</button>
            </div>
          </div>
        </article>`;
    }).join("");
  }

  function renderAll() {
    renderBalance();
    renderReport();
    renderTransactions();
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => { toast.textContent = ""; }, 2600);
  }

  function addTransaction(amount) {
    const category = $("#categorySelect").value;
    const note = $("#noteInput").value.trim();
    const transaction = {
      id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: selectedType,
      amount: Number(amount),
      category,
      note,
      date: new Date().toISOString()
    };
    transactions.push(transaction);
    if (saveTransactions()) {
      $("#noteInput").value = "";
      renderAll();
      showToast(`${selectedType === "income" ? "ເພີ່ມລາຍຮັບ" : "ບັນທຶກລາຍຈ່າຍ"} ${formatMoney(amount)} ສຳເລັດ`);
    }
  }

  function openEdit(id) {
    const item = transactions.find(transaction => transaction.id === id);
    if (!item) return;
    $("#editId").value = item.id;
    $("#editType").value = item.type;
    $("#editAmount").value = item.amount;
    $("#editCategory").value = item.category || "ອື່ນໆ";
    $("#editNote").value = item.note || "";
    const d = new Date(item.date);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    $("#editDate").value = local;
    $("#editDialog").showModal();
  }

  function deleteTransaction(id) {
    const item = transactions.find(transaction => transaction.id === id);
    if (!item) return;
    if (!confirm(`ຕ້ອງການລຶບລາຍການ ${formatMoney(item.amount)} ບໍ?`)) return;
    transactions = transactions.filter(transaction => transaction.id !== id);
    saveTransactions();
    renderAll();
  }

  function exportData() {
    const data = {
      app: "My Money",
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `my-money-backup-${localDateKey(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = Array.isArray(parsed) ? parsed : parsed.transactions;
        if (!Array.isArray(imported) || !imported.every(isValidTransaction)) {
          throw new Error("Invalid backup format");
        }
        if (!confirm(`ພົບ ${imported.length} ລາຍການ. ການນຳເຂົ້າຈະແທນຂໍ້ມູນປັດຈຸບັນ. ດຳເນີນການບໍ?`)) return;
        transactions = imported;
        saveTransactions();
        renderAll();
        alert("ນຳເຂົ້າຂໍ້ມູນສຳເລັດ");
      } catch (error) {
        alert("ໄຟລ໌ສຳຮອງບໍ່ຖືກຕ້ອງ ຫຼືເສຍຫາຍ");
      }
      $("#importInput").value = "";
    };
    reader.readAsText(file);
  }

  $$(".type-btn").forEach(button => {
    button.addEventListener("click", () => {
      selectedType = button.dataset.type;
      $$(".type-btn").forEach(btn => {
        const active = btn === button;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    });
  });

  $$(".amount-btn").forEach(button => {
    button.addEventListener("click", () => addTransaction(Number(button.dataset.amount)));
  });

  $$(".report-tab").forEach(button => {
    button.addEventListener("click", () => {
      selectedPeriod = button.dataset.period;
      $$(".report-tab").forEach(tab => {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      renderReport();
    });
  });

  $("#historyFilter").addEventListener("change", renderTransactions);
  $("#transactionList").addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    if (editButton) openEdit(editButton.dataset.edit);
    if (deleteButton) deleteTransaction(deleteButton.dataset.delete);
  });

  $("#editForm").addEventListener("submit", event => {
    event.preventDefault();
    const id = $("#editId").value;
    const amount = Number($("#editAmount").value);
    const category = $("#editCategory").value.trim();
    const dateValue = $("#editDate").value;
    if (!Number.isFinite(amount) || amount <= 0 || !category || !dateValue) {
      alert("ກະລຸນາກວດຂໍ້ມູນໃຫ້ຄົບຖ້ວນ");
      return;
    }
    transactions = transactions.map(item => item.id === id ? {
      ...item,
      type: $("#editType").value,
      amount: Math.round(amount),
      category,
      note: $("#editNote").value.trim(),
      date: dateFromInput(dateValue).toISOString()
    } : item);
    saveTransactions();
    $("#editDialog").close();
    renderAll();
  });

  $("#closeDialogBtn").addEventListener("click", () => $("#editDialog").close());
  $("#cancelEditBtn").addEventListener("click", () => $("#editDialog").close());
  $("#exportBtn").addEventListener("click", exportData);
  $("#importBtn").addEventListener("click", () => $("#importInput").click());
  $("#clearAllBtn").addEventListener("click", () => {
    if (!transactions.length) {
      alert("ບໍ່ມີຂໍ້ມູນໃຫ້ລຶບ");
      return;
    }
    if (!confirm("ລຶບລາຍການທັງໝົດບໍ? ການກະທຳນີ້ບໍ່ສາມາດກູ້ຄືນໄດ້. ຄວນສຳຮອງຂໍ້ມູນກ່ອນ.")) return;
    transactions = [];
    saveTransactions();
    renderAll();
  });
  $("#importInput").addEventListener("change", event => importData(event.target.files[0]));

  // Long-press / secondary action: clicking the backup label again is not required.
  // Import is also available from the browser console via the hidden file input if needed.
  // The visible button exports a JSON backup, which can be stored safely elsewhere.

  renderAll();
})();
