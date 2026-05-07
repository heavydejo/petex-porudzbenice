
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://mlnmbdlgraxeclhqbyct.supabase.co",
  "sb_publishable_FEKbD8TuoPqyZ4TM_Ci27A_T9ReJNaz"
);

const ADMIN_PASSWORD = "petex2026";
const WAREHOUSE_PASSWORD = "magacin2026";

function emptyRow() {
  return { article: "", qty: "", unit: "kom", picked: false };
}

function startingRows() {
  const isMobile = window.innerWidth <= 700;
  return Array.from({ length: isMobile ? 10 : 15 }, emptyRow);
}

function makeOrderNumber(count) {
  const year = new Date().getFullYear();
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

function normalizeOrder(o) {
  return {
    id: o.id,
    orderNo: o.order_no,
    buyer: o.buyer,
    phone: o.phone || "",
    city: o.city || "",
    delivery: o.delivery || "DA",
    date: o.order_date,
    note: o.note || "",
    status: o.status || "Nova",
    items: (o.items || []).map((i) => ({ unit: "kom", picked: false, ...i })),
    createdAt: o.created_at,
  };
}

function qtyNumber(value) {
  const n = parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}


function formatOrderNo(id) {
  const year = new Date().getFullYear();
  return `PET-${year}-${String(id).padStart(4, "0")}`;
}

function stavkaText(n) {
  if (n === 1) return "1 stavka";
  if (n >= 2 && n <= 4) return `${n} stavke`;
  return `${n} stavki`;
}


function stats(items) {
  return {
    lines: items.length,
    total: items.reduce((sum, i) => sum + qtyNumber(i.qty), 0),
  };
}

function statusClass(status) {
  if (status === "Nova") return "status blue";
  if (status === "U obradi") return "status orange";
  if (status === "Izdvojeno") return "status green";
  if (status === "Završeno") return "status purple";
  return "status";
}

export default function App() {
  const path = window.location.pathname;
  const isAdminPage = path.includes("admin");
  const isWarehousePage = path.includes("magacin");

  const [orders, setOrders] = useState([]);
  const [view, setView] = useState(isAdminPage ? "admin" : isWarehousePage ? "warehouse" : "form");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sentOrder, setSentOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [adminUnlocked, setAdminUnlocked] = useState(!isAdminPage);
  const [warehouseUnlocked, setWarehouseUnlocked] = useState(!isWarehousePage);
  const [password, setPassword] = useState("");

  const [form, setForm] = useState({
    orderNo: "",
    buyer: "",
    phone: "",
    city: "",
    delivery: "DA",
    date: new Date().toISOString().slice(0, 10),
    note: "",
    items: startingRows(),
  });

  const filledItems = useMemo(
    () => form.items.filter((i) => i.article.trim() || i.qty.trim()),
    [form.items]
  );

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter((o) =>
      [o.orderNo, o.buyer, o.phone, o.city, o.status, o.note]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [orders, search]);

  const warehouseOrders = filteredOrders.filter((o) => o.status !== "Završeno");

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);

    if (error) return alert("Greška pri čitanju narudžbi: " + error.message);

    const normalized = (data || []).map(normalizeOrder).filter((o) => o.status !== "Obrisano");
    setOrders(normalized);
    setForm((prev) => ({ ...prev, orderNo: "" }));
  }

  function unlock(type) {
    if (type === "admin" && password === ADMIN_PASSWORD) {
      setAdminUnlocked(true);
      setPassword("");
      return;
    }
    if (type === "warehouse" && password === WAREHOUSE_PASSWORD) {
      setWarehouseUnlocked(true);
      setPassword("");
      return;
    }
    alert("Pogrešna šifra.");
  }

  function updateItem(index, key, value) {
    const items = [...form.items];
    items[index] = { ...items[index], [key]: value };
    setForm({ ...form, items });
  }

  function addRows() {
    setForm({
      ...form,
      items: [...form.items, ...Array.from({ length: 5 }, emptyRow)],
    });
  }

  async function sendOrder() {
    if (!form.buyer.trim()) return alert("Unesite kupca / firmu.");
    if (!form.phone.trim()) return alert("Unesite telefon.");
    if (filledItems.length === 0) return alert("Unesite makar jednu stavku robe.");

    setLoading(true);
    const payload = {
      order_no: null,
      buyer: form.buyer,
      phone: form.phone,
      city: form.city,
      delivery: form.delivery,
      order_date: form.date,
      note: form.note,
      status: "Nova",
      items: filledItems,
    };

    const { data, error } = await supabase.from("orders").insert(payload).select().single();

    if (error) {
      setLoading(false);
      return alert("Greška pri slanju narudžbe: " + error.message);
    }

    const generatedOrderNo = formatOrderNo(data.id);
    const { data: updatedData, error: updateError } = await supabase
      .from("orders")
      .update({ order_no: generatedOrderNo })
      .eq("id", data.id)
      .select()
      .single();

    setLoading(false);

    if (updateError) return alert("Narudžba je snimljena, ali broj nije ažuriran: " + updateError.message);

    const order = normalizeOrder(updatedData);
    setOrders([order, ...orders]);
    setSentOrder(order);
    setSelectedOrder(order);
    setView("sent");

    setForm({
      orderNo: "",
      buyer: "",
      phone: "",
      city: "",
      delivery: "DA",
      date: new Date().toISOString().slice(0, 10),
      note: "",
      items: startingRows(),
    });
  }

  async function deleteOrder(order) {
    const answer = prompt(`Za uklanjanje narudžbe #${order.orderNo} iz pregleda ukucajte OBRISI`);
    if (answer !== "OBRISI") return alert("Brisanje otkazano.");

    const { error } = await supabase.from("orders").update({ status: "Obrisano" }).eq("id", order.id);
    if (error) return alert("Greška pri brisanju: " + error.message);

    setOrders(orders.filter((o) => o.id !== order.id));
    if (selectedOrder?.id === order.id) setSelectedOrder(null);
    setMessage(`Narudžba #${order.orderNo} je uklonjena iz pregleda.`);
    setTimeout(() => setMessage(""), 3500);
  }

  async function updateStatus(order, status) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", order.id);
    if (error) return alert("Greška pri promjeni statusa: " + error.message);
    const updatedOrder = { ...order, status };
    const updated = orders.map((o) => o.id === order.id ? updatedOrder : o);
    setOrders(updated);
    setSelectedOrder(updatedOrder);
    setMessage(`Status narudžbe #${order.orderNo} promijenjen u: ${status}`);
    setTimeout(() => setMessage(""), 3500);
    if (status === "Završeno") setView(isWarehousePage ? "warehouse" : "admin");
  }

  async function togglePicked(order, index) {
    const items = [...order.items];
    items[index] = { ...items[index], picked: !items[index].picked };
    const status = items.every((i) => i.picked) ? "Izdvojeno" : "U obradi";
    const { error } = await supabase.from("orders").update({ items, status }).eq("id", order.id);
    if (error) return alert("Greška pri ažuriranju: " + error.message);
    const updatedOrder = { ...order, items, status };
    const updated = orders.map((o) => o.id === order.id ? updatedOrder : o);
    setOrders(updated);
    setSelectedOrder(updatedOrder);
  }

  const activeOrder = selectedOrder || sentOrder || orders[0];

  if (isAdminPage && !adminUnlocked) return <Login title="PETEX Admin" subtitle="Unesite admin šifru." password={password} setPassword={setPassword} onUnlock={() => unlock("admin")} />;
  if (isWarehousePage && !warehouseUnlocked) return <Login title="PETEX Magacin" subtitle="Unesite šifru za magacin." password={password} setPassword={setPassword} onUnlock={() => unlock("warehouse")} />;

  return (
    <div className="page">
      <Style />

      <header className="top no-print">
        <div className="brand">
          <img src="/logo.png" alt="PETEX" />
          <div>
            <h1>PETEX</h1>
            <p>Partner portal za naručivanje robe</p>
          </div>
        </div>

        {(isAdminPage || isWarehousePage) && (
          <div>
            {isAdminPage && <button className="black" onClick={() => setView("admin")}>Admin</button>}
            {isWarehousePage && <button className="black" onClick={() => setView("warehouse")}>Magacin</button>}
            <button className="white" onClick={loadOrders}>Osvježi</button>
          </div>
        )}
      </header>

      {message && <div className="notice no-print">{message}</div>}
      {loading && <div className="card no-print">Učitavanje...</div>}

      {view === "form" && (
        <div className="card no-print">
          <h2>Nova narudžba</h2>

          <div className="grid">
            <ReadOnly label="Broj" value="Generiše se nakon slanja" />
            <ReadOnly label="Datum" value={form.date} />
            <Field label="Kupac / firma *"><input value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} /></Field>
            <Field label="Telefon *"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Grad"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Isporuka *"><select value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })}><option>DA</option><option>NE</option></select></Field>
          </div>

          <ItemsTable items={form.items} updateItem={updateItem} editable showCheck={false} />

          <div style={{marginTop:15}}>
            <Field label="Napomena"><input placeholder="Npr. hitno, izmiješati artikle, posebna napomena..." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          </div>

          <div className="actions">
            <button className="white" onClick={addRows}>Dodaj 5 redova</button>
            <button className="black" onClick={sendOrder}>Pošalji narudžbu</button>
          </div>
        </div>
      )}

      {view === "sent" && sentOrder && (
        <div className="card no-print">
          <div className="success box">
            <h2>Narudžba je uspješno poslata.</h2>
            <p>Broj narudžbe: <b>{sentOrder.orderNo}</b></p>
          </div>
          <button className="black" onClick={() => { setSelectedOrder(sentOrder); setView("print"); }}>Otvori A4 / PDF</button>
          <button className="white" onClick={() => { setSentOrder(null); setSelectedOrder(null); setView("form"); }}>Nova narudžba</button>
        </div>
      )}

      {view === "admin" && (
        <AdminList
          orders={filteredOrders}
          search={search}
          setSearch={setSearch}
          setSelectedOrder={setSelectedOrder}
          setView={setView}
          deleteOrder={deleteOrder}
        />
      )}

      {view === "warehouse" && (
        <WarehouseList
          orders={warehouseOrders}
          search={search}
          setSearch={setSearch}
          setSelectedOrder={setSelectedOrder}
          setView={setView}
        />
      )}

      {view === "pick" && activeOrder && (
        <Picking
          order={activeOrder}
          togglePicked={togglePicked}
          updateStatus={updateStatus}
          setView={setView}
          isWarehousePage={isWarehousePage}
        />
      )}

      {view === "print" && activeOrder && (
        <PrintA4 order={activeOrder} back={() => setView(isAdminPage ? "admin" : isWarehousePage ? "warehouse" : "sent")} type="client" />
      )}

      {view === "warehousePrint" && activeOrder && (
        <PrintA4 order={activeOrder} back={() => setView("pick")} type="warehouse" />
      )}
    </div>
  );
}

function AdminList({ orders, search, setSearch, setSelectedOrder, setView, deleteOrder }) {
  return (
    <div className="card no-print">
      <h2>Admin pregled</h2>
      <input className="search" placeholder="Pretraga: kupac, telefon, grad, broj..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {orders.length === 0 && <p>Nema narudžbi.</p>}
      {orders.map((order) => {
        const s = stats(order.items);
        return (
          <div className="order-row" key={order.id}>
            <div>
              <b>#{order.orderNo} — {order.buyer}</b>
              <div className="meta">{order.date} · {order.phone} · {order.city || "bez grada"} · {stavkaText(s.lines)} · ukupno {s.total}{order.status !== "Nova" && <> · <span className={statusClass(order.status)}>{order.status}</span></>}</div>
              {order.note && <div className="note-small">Napomena: {order.note}</div>}
            </div>
            <div>
              <button className="white" onClick={() => { setSelectedOrder(order); setView("pick"); }}>Izdvajanje</button>
              <button className="white" onClick={() => { setSelectedOrder(order); setView("print"); }}>A4/PDF</button>
              <button className="danger" onClick={() => deleteOrder(order)}>Obriši</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WarehouseList({ orders, search, setSearch, setSelectedOrder, setView }) {
  return (
    <div className="card no-print">
      <h2>Magacin</h2>
      <p className="hint">Prikazane su samo aktivne narudžbe. Završene se ne prikazuju.</p>
      <input className="search" placeholder="Pretraga: kupac, telefon, grad, broj..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {orders.length === 0 && <p>Nema aktivnih narudžbi.</p>}
      {orders.map((order) => {
        const s = stats(order.items);
        return (
          <div className="order-row warehouse-card" key={order.id}>
            <div>
              <b>#{order.orderNo} — {order.buyer}</b>
              <div className="meta">{stavkaText(s.lines)} · ukupno {s.total} · Isporuka: {order.delivery}{order.status !== "Nova" && <> · <span className={statusClass(order.status)}>{order.status}</span></>}</div>
              {order.note && <div className="note-small">Napomena: {order.note}</div>}
            </div>
            <div>
              <button className="black" onClick={() => { setSelectedOrder(order); setView("pick"); }}>Otvori izdvajanje</button>
              <button className="white" onClick={() => { setSelectedOrder(order); setView("warehousePrint"); }}>Štampaj listu</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Picking({ order, togglePicked, updateStatus, setView, isWarehousePage }) {
  const s = stats(order.items);
  return (
    <div className="card no-print">
      <h2>Izdvajanje robe — #{order.orderNo}</h2>
      <p><b>{order.buyer}</b> · {stavkaText(s.lines)} · ukupno {s.total}{order.status !== "Nova" && <> · <span className={statusClass(order.status)}>{order.status}</span></>}</p>
      {order.note && <div className="note-big">Napomena: {order.note}</div>}
      {order.items.map((item, index) => (
        <button key={index} className={"pick-row " + (item.picked ? "picked" : "")} onClick={() => togglePicked(order, index)}>
          <span><b>{index + 1}.</b> {item.article}</span>
          <span><b>{item.qty} {item.unit || "kom"}</b> {item.picked ? "✓" : ""}</span>
        </button>
      ))}
      <div className="actions">
        <button className="white" onClick={() => setView(isWarehousePage ? "warehouse" : "admin")}>Nazad</button>
        <button className="white" onClick={() => setView("warehousePrint")}>Štampaj listu</button>
        <button className="black" onClick={() => updateStatus(order, "Završeno")}>Označi završeno</button>
      </div>
    </div>
  );
}

function PrintA4({ order, back, type }) {
  const s = stats(order.items);
  const isWarehouse = type === "warehouse";
  return (
    <div className="card print-card">
      <div className="no-print actions">
        <button className="white" onClick={back}>Nazad</button>
        <button className="black" onClick={() => window.print()}>Štampaj / Sačuvaj PDF</button>
      </div>

      <div className="a4-header">
        <img src="/logo.png" alt="PETEX" />
        <div>
          <h2>{isWarehouse ? "Magacinska lista za izdvajanje" : "Otpremnica / Narudžba"}</h2>
          <p><b>Broj:</b> {order.orderNo}</p>
          <p><b>Datum:</b> {order.date}</p>
        </div>
      </div>

      <div className="info-grid">
        <p><b>Kupac:</b> {order.buyer}</p>
        <p><b>Telefon:</b> {order.phone}</p>
        <p><b>Grad:</b> {order.city || "-"}</p>
        <p><b>Isporuka:</b> {order.delivery}</p>
        <p><b>Ukupno:</b> {stavkaText(s.lines)} · ukupno {s.total}</p>
      </div>

      {order.note && <p className="print-note"><b>Napomena:</b> {order.note}</p>}

      <ItemsTable items={order.items} showCheck={isWarehouse} />

      <div className="sign-row">
        <div>Pripremio / magacin<br /><span></span></div>
        <div>Potpis kupca<br /><span></span></div>
        <div>Pečat<br /><span></span></div>
      </div>
    </div>
  );
}

function ItemsTable({ items, editable, updateItem, showCheck = true }) {
  return (
    <table>
      <thead>
        <tr><th className="col-rb">rb.</th><th>Šifra / artikal</th><th className="col-qty">Kol.</th><th className="col-unit">JM</th>{showCheck && <th className="col-check">✓</th>}</tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={index}>
            <td className="col-rb">{index + 1}</td>
            <td>{editable ? <input placeholder="Šifra / artikal" value={item.article} onChange={(e) => updateItem(index, "article", e.target.value)} /> : item.article}</td>
            <td className="col-qty">{editable ? <input placeholder="Kol." value={item.qty} onChange={(e) => updateItem(index, "qty", e.target.value)} /> : <b>{item.qty}</b>}</td>
            <td className="col-unit">{editable ? <select value={item.unit || "kom"} onChange={(e) => updateItem(index, "unit", e.target.value)}><option>kom</option><option>pak</option><option>kart</option><option>set</option></select> : (item.unit || "kom")}</td>
            {showCheck && <td className="col-check">□</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Field({ label, children }) {
  return <label><span>{label}</span>{children}</label>;
}

function ReadOnly({ label, value }) {
  return <label><span>{label}</span><div className="readonly">{value}</div></label>;
}

function Login({ title, subtitle, password, setPassword, onUnlock }) {
  return (
    <div className="login-page">
      <Style />
      <div className="login-card">
        <img src="/logo.png" alt="PETEX" />
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onUnlock()} placeholder="Šifra" />
        <button className="black" onClick={onUnlock}>Ulaz</button>
      </div>
    </div>
  );
}

function Style() {
  return <style>{`
    body { margin:0; background:#f1f5f9; font-family:Arial,sans-serif; color:#111827; }
    .page { padding:16px; max-width:1120px; margin:auto; }
    .top { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:18px; }
    .brand { display:flex; align-items:center; gap:14px; }
    .brand img { width:92px; height:auto; object-fit:contain; }
    .brand h1 { margin:0; font-size:34px; letter-spacing:1px; }
    .brand p { margin:0; color:#64748b; }
    .card { background:white; border-radius:18px; padding:22px; box-shadow:0 2px 12px rgba(0,0,0,.08); margin-bottom:20px; }
    .grid, .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    label { font-size:14px; font-weight:bold; display:block; }
    input,select { width:100%; box-sizing:border-box; padding:11px; border-radius:10px; border:1px solid #cbd5e1; margin-top:5px; font-size:16px; background:white; }
    .readonly { padding:12px; border-radius:10px; background:#f8fafc; border:1px solid #e2e8f0; margin-top:5px; }
    button { padding:11px 16px; border:none; border-radius:11px; cursor:pointer; margin:4px; font-weight:bold; }
    .black { background:#111827; color:white; } .white { background:white; border:1px solid #cbd5e1; }
    .danger { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
    .success { background:#dcfce7; border:1px solid #86efac; color:#166534; }
    .box { padding:14px; border-radius:12px; margin-bottom:15px; }
    .notice { background:#dcfce7; color:#166534; border:1px solid #86efac; padding:12px 14px; border-radius:12px; margin-bottom:14px; font-weight:bold; }
    .actions { margin-top:18px; }
    table { width:100%; border-collapse:collapse; margin-top:18px; table-layout:fixed; }
    th,td { border:1px solid #d1d5db; padding:9px; text-align:left; vertical-align:middle; }
    th { background:#f3f4f6; font-size:14px; }
    .col-rb { width:48px; text-align:center; } .col-qty { width:82px; } .col-unit { width:58px; } .col-check { width:44px; text-align:center; }
    .order-row { border-bottom:1px solid #e5e7eb; padding:12px 0; display:flex; justify-content:space-between; gap:15px; align-items:center; }
    .warehouse-card { border:1px solid #e5e7eb; border-radius:14px; padding:14px; margin:10px 0; }
    .meta, .hint { color:#64748b; font-size:14px; margin-top:4px; }
    .note-small { color:#991b1b; font-size:13px; margin-top:4px; }
    .note-big, .print-note { background:#fff7ed; border:1px solid #fed7aa; padding:10px; border-radius:10px; margin:10px 0; }
    .status { padding:3px 8px; border-radius:999px; font-size:12px; font-weight:bold; }
    .blue { background:#dbeafe; color:#1e40af; } .orange { background:#ffedd5; color:#9a3412; }
    .green { background:#dcfce7; color:#166534; } .purple { background:#ede9fe; color:#5b21b6; }
    .pick-row { width:100%; text-align:left; border:1px solid #ddd; background:white; display:flex; justify-content:space-between; margin-bottom:8px; }
    .picked { background:#dcfce7; }
    .a4-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111827; padding-bottom:14px; gap:20px; }
    .a4-header img { width:170px; height:auto; object-fit:contain; }
    .sign-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:24px; margin-top:50px; text-align:center; }
    .sign-row span { display:block; height:55px; border-bottom:1px solid #111827; }
    .login-page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; background:#f1f5f9; }
    .login-card { width:100%; max-width:380px; background:white; border-radius:18px; padding:26px; box-shadow:0 2px 18px rgba(0,0,0,.1); text-align:center; }
    .login-card img { width:180px; }
    @media(max-width:700px) {
      .page{padding:10px;} .card{padding:14px;border-radius:14px;} .grid,.info-grid,.top{grid-template-columns:1fr;display:block;} .order-row{display:block;}
      .brand img{width:76px;} .brand h1{font-size:28px;} th,td{padding:5px;} .col-rb{width:30px;font-size:12px;} .col-qty{width:50px;} .col-unit{width:46px;} .col-check{width:28px;}
      td input{padding:8px 4px;font-size:13px;border-radius:8px;} td select{padding:8px 2px;font-size:12px;border-radius:8px;} th{font-size:12px;} .sign-row{grid-template-columns:1fr; gap:14px;}
    }
    @media print {
      .no-print{display:none!important;} body{background:white;} .page{max-width:none;padding:0;} .card{box-shadow:none;border-radius:0;padding:0;} .print-card{font-size:12px;}
      .a4-header img{width:150px;} th,td{padding:6px;} @page { size: A4; margin: 12mm; }
    }
  `}</style>;
}
