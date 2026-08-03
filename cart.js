(() => {
  "use strict";

  const STORAGE_KEY = "abyssinianCart";
  const DELIVERY_FEE = 4;
  const TAX_RATE = 0.08;
  const DISCOUNT_THRESHOLD = 50;
  const DISCOUNT_RATE = 0.1;
  const TOAST_DURATION = 2200;

  let toastTimer = null;

  const getCart = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(stored) ? stored : [];
    } catch (err) {
      return [];
    }
  };

  const saveCart = (cart) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));

  const byId = (id) => document.getElementById(id);

  const findItem = (cart, id) => cart.find((item) => item.id === id);

  const totalQty = (cart) => cart.reduce((sum, item) => sum + item.qty, 0);

  const setText = (id, text) => {
    const el = byId(id);
    if (el) el.textContent = text;
  };

  const formatMoney = (value) => `ETB ${value.toFixed(2)}`;

  const showToast = (message) => {
    let toast = byId("cart-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "cart-toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => toast.classList.remove("is-visible"),
      TOAST_DURATION,
    );
  };

  const updateBadge = (cart) => {
    const badge = byId("cart-badge");
    if (!badge) return;
    const total = totalQty(cart);
    badge.textContent = total;
    badge.classList.toggle("is-hidden", total === 0);
  };

  const updateCountLine = (cart) => {
    const count = byId("cart-count");
    if (count) count.textContent = totalQty(cart);
  };

  const initMenuPage = () => {
    const buttons = document.querySelectorAll(".btn-add");
    if (!buttons.length) return false;

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const item = {
          id: button.dataset.id,
          name: button.dataset.name,
          desc: button.dataset.desc,
          price: parseFloat(button.dataset.price),
          img: button.dataset.img,
          qty: 1,
        };
        addToCart(item);
      });
    });
    return true;
  };

  const addToCart = (item) => {
    const cart = getCart();
    const existing = findItem(cart, item.id);

    if (existing) {
      existing.qty += 1;
    } else {
      cart.push(item);
    }

    saveCart(cart);
    updateBadge(cart);
    showToast(`${item.name} added to cart`);
  };

  const initCartPage = () => {
    const list = byId("cart-items");
    if (!list) return false;

    renderCart();
    list.addEventListener("click", handleItemClick);
    byId("place-order").addEventListener("click", placeOrder);

    const modal = byId("order-modal");
    if (modal) {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) modal.classList.remove("is-open");
      });
    }
    return true;
  };

  const handleItemClick = (event) => {
    const button = event.target.closest("[data-action]");
    const itemEl = button && button.closest(".cart-item");
    if (!button || !itemEl) return;

    const { id } = itemEl.dataset;
    const action = button.dataset.action;

    if (action === "plus") changeQty(id, 1);
    if (action === "minus") changeQty(id, -1);
    if (action === "remove") removeItem(id);
  };

  const renderCart = () => {
    const cart = getCart();
    const list = byId("cart-items");
    const empty = byId("cart-empty");
    const summary = byId("cart-summary");
    const countLine = byId("cart-count-line");

    updateCountLine(cart);
    if (countLine) countLine.classList.toggle("is-hidden", cart.length === 0);

    if (cart.length === 0) {
      list.innerHTML = "";
      if (empty) empty.classList.remove("is-hidden");
      if (summary) summary.classList.add("is-hidden");
      updateBadge(cart);
      return;
    }

    if (empty) empty.classList.add("is-hidden");
    if (summary) summary.classList.remove("is-hidden");

    list.innerHTML = cart.map(cartItemTemplate).join("");

    updateTotals(cart);
    updateBadge(cart);
  };

  const cartItemTemplate = (item) => {
    const minusDisabled = item.qty <= 1 ? " disabled" : "";
    return `
      <article class="cart-item" data-id="${item.id}">
        <img class="cart-item-img" src="${item.img}" alt="${item.name}" />
        <div class="cart-item-body">
          <div class="cart-item-header">
            <div class="cart-item-heading">
              <h4 class="cart-item-name">${item.name}</h4>
              <p class="cart-item-desc">${item.desc}</p>
            </div>
            <span class="cart-item-unit">${formatMoney(item.price)}</span>
          </div>
          <div class="cart-item-footer">
            <div class="qty-control">
              <button type="button" class="qty-btn" data-action="minus"${minusDisabled} aria-label="Decrease quantity">&minus;</button>
              <span class="qty-value">${item.qty}</span>
              <button type="button" class="qty-btn" data-action="plus" aria-label="Increase quantity">&plus;</button>
            </div>
            <div class="cart-item-subtotal">
              <span class="label">Item Total</span>
              <span class="value">${formatMoney(item.price * item.qty)}</span>
            </div>
            <button type="button" class="btn-remove" data-action="remove">Remove</button>
          </div>
        </div>
      </article>
    `;
  };

  const changeQty = (id, delta) => {
    const cart = getCart();
    const item = findItem(cart, id);
    if (!item) return;

    const next = item.qty + delta;
    if (next < 1) return;

    item.qty = next;
    saveCart(cart);

    updateQtyUI(id, item);
    updateTotals(cart);
    updateCountLine(cart);
    updateBadge(cart);
    showToast(`${item.name} quantity updated`);
  };

  const updateQtyUI = (id, item) => {
    const el = document.querySelector(`.cart-item[data-id="${id}"]`);
    if (!el) return;

    const qty = el.querySelector(".qty-value");
    const subtotal = el.querySelector(".cart-item-subtotal .value");
    const minus = el.querySelector('[data-action="minus"]');

    if (qty) qty.textContent = item.qty;
    if (subtotal) subtotal.textContent = formatMoney(item.price * item.qty);
    if (minus) minus.disabled = item.qty <= 1;
  };

  const removeItem = (id) => {
    const cart = getCart();
    const item = findItem(cart, id);
    if (!item) return;

    const confirmed = window.confirm(`Remove "${item.name}" from your cart?`);
    if (!confirmed) return;

    const updated = cart.filter((i) => i.id !== id);
    saveCart(updated);
    renderCart();
    showToast(`${item.name} removed from cart`);
  };

  const calculateDiscount = (subtotal) =>
    subtotal >= DISCOUNT_THRESHOLD ? subtotal * DISCOUNT_RATE : 0;

  const updateTotals = (cart) => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

    const delivery = subtotal > 0 ? DELIVERY_FEE : 0;
    const tax = subtotal * TAX_RATE;
    const discount = calculateDiscount(subtotal);
    const grand = subtotal + delivery + tax - discount;

    setText("summary-subtotal", formatMoney(subtotal));
    setText("summary-delivery", formatMoney(delivery));
    setText("summary-tax", formatMoney(tax));
    setText(
      "summary-discount",
      discount > 0 ? `-${formatMoney(discount)}` : formatMoney(discount),
    );

    const discountEl = byId("summary-discount");
    if (discountEl) discountEl.classList.toggle("is-active", discount > 0);

    setText("summary-grand", formatMoney(grand));
  };

  const placeOrder = () => {
    const cart = getCart();
    if (cart.length === 0) return;

    saveCart([]);
    renderCart();
    showToast("Order placed successfully");
    openModal();
  };

  const openModal = () => {
    const modal = byId("order-modal");
    if (modal) modal.classList.add("is-open");
  };

  document.addEventListener("DOMContentLoaded", () => {
    updateBadge(getCart());
    if (!initCartPage()) {
      initMenuPage();
    }
  });
})();
