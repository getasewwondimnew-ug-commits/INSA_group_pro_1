(() => {
  const KEY = "abyssinianCart";
  const DELIVERY = 4, TAX = 0.08, DISCOUNT_MIN = 50, DISCOUNT_RATE = 0.1, TOAST_MS = 2200;
  let toastTimer = null;
  let sortAscending = true;

  const $ = (id) => document.getElementById(id);
  const money = (n) => `ETB ${n.toFixed(2)}`;

  const getCart = () => {
    try {
      const c = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(c) ? c : [];
    } catch {
      return [];
    }
  };
  const saveCart = (cart) => localStorage.setItem(KEY, JSON.stringify(cart));
  const totalQty = (cart) => cart.reduce((n, i) => n + i.qty, 0);
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  const showToast = (msg) => {
    let toast = $("cart-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cart-toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), TOAST_MS);
  };

  const updateBadge = (cart) => {
    const badge = $("cart-badge");
    if (!badge) return;
    const total = totalQty(cart);
    badge.textContent = total;
    badge.classList.toggle("is-hidden", total === 0);
  };

  const addToCart = (item) => {
    const cart = getCart();
    const existing = cart.find((i) => i.id === item.id);
    existing ? existing.qty++ : cart.push(item);
    saveCart(cart);
    updateBadge(cart);
    showToast(`${item.name} added to cart`);
  };

  const cardFor = (btn) => {
    let el = btn;
    while (el.parentElement && el.parentElement.querySelectorAll(".btn-add").length === 1) {
      el = el.parentElement;
    }
    return el;
  };

  const sortMenuByPrice = (ascending) => {
    const groups = new Map();

    document.querySelectorAll(".btn-add").forEach((btn) => {
      const card = cardFor(btn);
      const container = card.parentElement;
      if (!groups.has(container)) groups.set(container, []);
      groups.get(container).push({ card, price: parseFloat(btn.dataset.price) });
    });

    groups.forEach((items, container) => {
      items.sort((a, b) => (ascending ? a.price - b.price : b.price - a.price));
      items.forEach(({ card }) => container.appendChild(card));
    });
  };

  const initSortButton = () => {
    const sortBtn = $("sort-price");
    if (!sortBtn) return;
    sortBtn.textContent = "Sort: Price ↑";
    sortBtn.addEventListener("click", () => {
      sortMenuByPrice(sortAscending);
      sortBtn.textContent = sortAscending ? "Sort: Price ↓" : "Sort: Price ↑";
      sortAscending = !sortAscending;
    });
  };

  const initMenuPage = () => {
    const buttons = document.querySelectorAll(".btn-add");
    if (!buttons.length) return false;
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const { id, name, desc, price, img } = btn.dataset;
        addToCart({ id, name, desc, price: parseFloat(price), img, qty: 1 });
      });
    });
    initSortButton();
    return true;
  };

  const cartItemTemplate = (item) => `
    <article class="cart-item" data-id="${item.id}">
      <img class="cart-item-img" src="${item.img}" alt="${item.name}" />
      <div class="cart-item-body">
        <div class="cart-item-header">
          <div class="cart-item-heading">
            <h4 class="cart-item-name">${item.name}</h4>
            <p class="cart-item-desc">${item.desc}</p>
          </div>
          <span class="cart-item-unit">${money(item.price)}</span>
        </div>
        <div class="cart-item-footer">
          <div class="qty-control">
            <button type="button" class="qty-btn" data-action="minus"${item.qty <= 1 ? " disabled" : ""} aria-label="Decrease quantity">&minus;</button>
            <span class="qty-value">${item.qty}</span>
            <button type="button" class="qty-btn" data-action="plus" aria-label="Increase quantity">&plus;</button>
          </div>
          <div class="cart-item-subtotal">
            <span class="label">Item Total</span>
            <span class="value">${money(item.price * item.qty)}</span>
          </div>
          <button type="button" class="btn-remove" data-action="remove">Remove</button>
        </div>
      </div>
    </article>`;

  const calculateDiscount = (subtotal) => (subtotal >= DISCOUNT_MIN ? subtotal * DISCOUNT_RATE : 0);

  const updateTotals = (cart) => {
    const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    const delivery = subtotal > 0 ? DELIVERY : 0;
    const tax = subtotal * TAX;
    const discount = calculateDiscount(subtotal);
    const grand = subtotal + delivery + tax - discount;

    setText("summary-subtotal", money(subtotal));
    setText("summary-delivery", money(delivery));
    setText("summary-tax", money(tax));
    setText("summary-discount", discount > 0 ? `-${money(discount)}` : money(discount));
    $("summary-discount")?.classList.toggle("is-active", discount > 0);
    setText("summary-grand", money(grand));
  };

  const renderCart = () => {
    const cart = getCart();
    const list = $("cart-items");
    const empty = $("cart-empty");
    const summary = $("cart-summary");
    const countLine = $("cart-count-line");

    setText("cart-count", totalQty(cart));
    countLine?.classList.toggle("is-hidden", cart.length === 0);

    if (cart.length === 0) {
      list.innerHTML = "";
      empty?.classList.remove("is-hidden");
      summary?.classList.add("is-hidden");
      updateBadge(cart);
      return;
    }

    empty?.classList.add("is-hidden");
    summary?.classList.remove("is-hidden");
    list.innerHTML = cart.map(cartItemTemplate).join("");
    updateTotals(cart);
    updateBadge(cart);
  };

  const changeQty = (id, delta) => {
    const cart = getCart();
    const item = cart.find((i) => i.id === id);
    if (!item || item.qty + delta < 1) return;

    item.qty += delta;
    saveCart(cart);

    const el = document.querySelector(`.cart-item[data-id="${id}"]`);
    if (el) {
      el.querySelector(".qty-value").textContent = item.qty;
      el.querySelector(".cart-item-subtotal .value").textContent = money(item.price * item.qty);
      el.querySelector('[data-action="minus"]').disabled = item.qty <= 1;
    }

    updateTotals(cart);
    setText("cart-count", totalQty(cart));
    updateBadge(cart);
    showToast(`${item.name} quantity updated`);
  };

  const removeItem = (id) => {
    const cart = getCart();
    const item = cart.find((i) => i.id === id);
    if (!item || !window.confirm(`Remove "${item.name}" from your cart?`)) return;

    saveCart(cart.filter((i) => i.id !== id));
    renderCart();
    showToast(`${item.name} removed from cart`);
  };

  const placeOrder = () => {
    if (getCart().length === 0) return;
    saveCart([]);
    renderCart();
    showToast("Order placed successfully");
    $("order-modal")?.classList.add("is-open");
  };

  const initCartPage = () => {
    const list = $("cart-items");
    if (!list) return false;

    renderCart();
    list.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      const itemEl = btn?.closest(".cart-item");
      if (!btn || !itemEl) return;
      const { id } = itemEl.dataset;
      if (btn.dataset.action === "plus") changeQty(id, 1);
      if (btn.dataset.action === "minus") changeQty(id, -1);
      if (btn.dataset.action === "remove") removeItem(id);
    });
    $("place-order").addEventListener("click", placeOrder);

    const modal = $("order-modal");
    modal?.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("is-open");
    });
    return true;
  };

  document.addEventListener("DOMContentLoaded", () => {
    updateBadge(getCart());
    if (!initCartPage()) initMenuPage();
  });
})();