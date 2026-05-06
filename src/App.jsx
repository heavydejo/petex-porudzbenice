
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://mlnmbdlgraxeclhqbyct.supabase.co",
  "sb_publishable_FEKbD8TuoPqyZ4TM_Ci27A_T9ReJNaz"
);

const emptyItems = Array.from({ length: 10 }, () => ({ article: "", qty: "", picked: false }));

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
    items: o.items || [],
    createdAt: o.created_at,
  };
}

export default function App() {
  const isAdminPage = window.location.pathname.includes("admin");
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState(isAdminPage ? "admin" : "form");
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [sentOrder, setSentOrder] = useState(null);
  const [form, setForm] = useState({
    orderNo: makeOrderNumber(0),
    buyer: "",
    phone: "",
    city: "",
    delivery: "DA",
    date: new Date().toISOString().slice(0, 10),
    note: "",
    items: emptyItems,
  });

  const filledItems = useMemo(
    () => form.items.filter((i) => i.article.trim() || i.qty.trim()),
    [form.items]
  );

  useEffect(() => { loadOrders(); }, []);

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return alert("Greška pri čitanju porudžbina: " + error.message);
    const normalized = (data || []).map(normalizeOrder);
    setOrders(normalized);
    setForm((prev) => ({ ...prev, orderNo: makeOrderNumber(normalized.length) }));
  }

  function updateItem(index, key, value) {
    const items = [...form.items];
    items[index] = { ...items[index], [key]: value };
    setForm({ ...form, items });
  }

  function addRows() {
    setForm({
      ...form,
      items: [...form.items, ...Array.from({ length: 5 }, () => ({ article: "", qty: "", picked: false }))],
    });
  }

  async function sendOrder() {
    if (!form.buyer.trim()) return alert("Unesite kupca.");
    if (filledItems.length === 0) return alert("Unesite makar jednu stavku robe.");
    setLoading(true);
    const payload = {
      order_no: form.orderNo,
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
    setLoading(false);
    if (error) return alert("Greška pri slanju porudžbine: " + error.message);

    const order = normalizeOrder(data);
    setOrders([order, ...orders]);
    setSentOrder(order);
    setSelectedOrder(order);
    setView("sent");
    setForm({
      orderNo: makeOrderNumber(orders.length + 1),
      buyer: "",
      phone: "",
      city: "",
      delivery: "DA",
      date: new Date().toISOString().slice(0, 10),
      note: "",
      items: emptyItems,
    });
  }

  async function deleteOrder(id) {
    if (!confirm("Obrisati porudžbenicu?")) return;
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) return alert("Greška pri brisanju: " + error.message);
    setOrders(orders.filter((o) => o.id !== id));
  }

  async function togglePicked(order, index) {
    const items = [...order.items];
    items[index] = { ...items[index], picked: !items[index].picked };
    const status = items.every((i) => i.picked) ? "Izdvojeno" : "U obradi";
    const { error } = await supabase.from("orders").update({ items, status }).eq("id", order.id);
    if (error) return alert("Greška pri ažuriranju: " + error.message);
    const updated = orders.map((o) => o.id === order.id ? { ...o, items, status } : o);
    setOrders(updated);
    setSelectedOrder({ ...order, items, status });
  }

  const activeOrder = selectedOrder || sentOrder || orders[0];

  return (
    <div className="page">
      <style>{`
        body { margin:0; background:#f1f5f9; font-family:Arial,sans-serif; color:#111827; }
        .page { padding:16px; max-width:1080px; margin:auto; }
        .top { display:flex; justify-content:space-between; align-items:center; gap:15px; margin-bottom:18px; }
        .card { background:white; border-radius:18px; padding:22px; box-shadow:0 2px 12px rgba(0,0,0,.08); margin-bottom:20px; }
        h1 { margin:0 0 6px 0; font-size:28px; } h2 { margin-top:0; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        label { font-size:14px; font-weight:bold; }
        input,select { width:100%; box-sizing:border-box; padding:11px; border-radius:10px; border:1px solid #cbd5e1; margin-top:5px; font-size:16px; background:white; }
        button { padding:11px 16px; border:none; border-radius:11px; cursor:pointer; margin:4px; font-weight:bold; }
        .black { background:#111827; color:white; } .white { background:white; border:1px solid #cbd5e1; }
        .danger { background:#fee2e2; color:#991b1b; border:1px solid #fecaca; }
        .success { background:#dcfce7; border:1px solid #86efac; color:#166534; }
        table { width:100%; border-collapse:collapse; margin-top:18px; table-layout:fixed; }
        th,td { border:1px solid #d1d5db; padding:9px; text-align:left; vertical-align:middle; }
        th { background:#f3f4f6; font-size:14px; }
        .col-rb { width:48px; text-align:center; } .col-qty { width:110px; }
        .order-row { border-bottom:1px solid #e5e7eb; padding:12px 0; display:flex; justify-content:space-between; gap:15px; align-items:center; }
        .pick-row { width:100%; text-align:left; border:1px solid #ddd; background:white; display:flex; justify-content:space-between; margin-bottom:8px; }
        .picked { background:#e5e7eb; } .print-header { display:flex; justify-content:space-between; border-bottom:1px solid #ddd; padding-bottom:15px; gap:15px; }
        .hint { color:#64748b; font-size:14px; }
        @media(max-width:700px) {
          .page{padding:10px;} .card{padding:14px;border-radius:14px;} .grid,.top{grid-template-columns:1fr;display:block;} .order-row{display:block;} h1{font-size:24px;}
          th,td{padding:6px;} .col-rb{width:34px;font-size:13px;} .col-qty{width:74px;}
          td input{padding:8px 6px;font-size:14px;border-radius:8px;} th{font-size:13px;}
        }
        @media print { .no-print{display:none!important;} body{background:white;} .page{max-width:none;padding:0;} .card{box-shadow:none;border-radius:0;padding:0;} }
      `}</style>

      <div className="top no-print">
        <div>
          <h1>PETEX porudžbenica</h1>
          <p className="hint">{isAdminPage ? "Admin pregled porudžbina." : "Popunite porudžbinu i kliknite Pošalji porudžbinu."}</p>
        </div>
        {isAdminPage && (
          <div>
            <button className="black" onClick={() => setView("admin")}>Admin pregled</button>
            <button className="white" onClick={() => { setView("form"); setSelectedOrder(null); }}>Nova porudžbenica</button>
          </div>
        )}
      </div>

      {loading && <div className="card no-print">Učitavanje...</div>}

      {view === "form" && (
        <div className="card no-print">
          <h2>Nova porudžbenica</h2>
          <div className="grid">
            <Field label="Porudžbenica br."><input value={form.orderNo} onChange={(e) => setForm({ ...form, orderNo: e.target.value })} /></Field>
            <Field label="Datum"><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Kupac *"><input value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} /></Field>
            <Field label="Telefon"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Grad"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Isporuka"><select value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })}><option>DA</option><option>NE</option></select></Field>
          </div>

          <table>
            <thead><tr><th className="col-rb">rb.</th><th>Šifra / artikal</th><th className="col-qty">Količina</th></tr></thead>
            <tbody>
              {form.items.map((item, index) => (
                <tr key={index}>
                  <td className="col-rb">{index + 1}</td>
                  <td><input placeholder="Šifra / artikal" value={item.article} onChange={(e) => updateItem(index, "article", e.target.value)} /></td>
                  <td className="col-qty"><input placeholder="kom." value={item.qty} onChange={(e) => updateItem(index, "qty", e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{marginTop:15}}><Field label="Napomena"><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field></div>
          <div style={{marginTop:20}}>
            <button className="white" onClick={addRows}>Dodaj redove</button>
            <button className="black" onClick={sendOrder}>Pošalji porudžbinu</button>
          </div>
        </div>
      )}

      {view === "sent" && sentOrder && (
        <div className="card no-print">
          <div className="success" style={{padding:14,borderRadius:12,marginBottom:15}}>
            <h2>Porudžbina je uspješno poslata.</h2>
            <p>Broj porudžbine: <b>{sentOrder.orderNo}</b></p>
          </div>
          <p>Kupac može odmah odštampati porudžbenicu ili sačuvati kao PDF.</p>
          <button className="black" onClick={() => { setSelectedOrder(sentOrder); setView("print"); }}>Otvori za štampu / PDF</button>
          <button className="white" onClick={() => { setSentOrder(null); setSelectedOrder(null); setView("form"); }}>Nova porudžbenica</button>
        </div>
      )}

      {view === "admin" && (
        <div className="card no-print">
          <h2>Admin pregled</h2>
          <button className="white" onClick={loadOrders}>Osvježi</button>
          {orders.length === 0 && <p>Nema porudžbina.</p>}
          {orders.map((order) => (
            <div className="order-row" key={order.id}>
              <div><b>#{order.orderNo} — {order.buyer}</b><br /><small>{order.date} · {order.city || "bez grada"} · Isporuka: {order.delivery} · Stavki: {order.items.length} · Status: <b>{order.status}</b></small></div>
              <div>
                <button className="white" onClick={() => { setSelectedOrder(order); setView("pick"); }}>Izdvajanje</button>
                <button className="white" onClick={() => { setSelectedOrder(order); setView("print"); }}>Otvori/Štampa</button>
                <button className="danger" onClick={() => deleteOrder(order.id)}>Obriši</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === "pick" && activeOrder && (
        <div className="card no-print">
          <h2>Izdvajanje robe — #{activeOrder.orderNo}</h2>
          <p>Kupac: <b>{activeOrder.buyer}</b></p>
          {activeOrder.items.map((item, index) => (
            <button key={index} className={"pick-row " + (item.picked ? "picked" : "")} onClick={() => togglePicked(activeOrder, index)}>
              <span><b>{index + 1}.</b> {item.article}</span><span><b>{item.qty}</b> {item.picked ? "✓" : ""}</span>
            </button>
          ))}
          <button className="white" onClick={() => setView("admin")}>Nazad</button>
          <button className="black" onClick={() => setView("print")}>Otvori za štampu</button>
        </div>
      )}

      {view === "print" && activeOrder && (
        <div className="card">
          <div className="no-print">
            <button className="white" onClick={() => isAdminPage ? setView("admin") : setView("sent")}>Nazad</button>
            <button className="black" onClick={() => window.print()}>Štampaj / Sačuvaj PDF</button>
          </div>
          <div className="print-header">
            <div><h2>PETEX SUVENIRI</h2><p>Porudžbenica robe</p></div>
            <div><p><b>Br:</b> {activeOrder.orderNo}</p><p><b>Datum:</b> {activeOrder.date}</p></div>
          </div>
          <div className="grid" style={{marginTop:15}}>
            <p><b>Kupac:</b> {activeOrder.buyer}</p><p><b>Telefon:</b> {activeOrder.phone}</p><p><b>Grad:</b> {activeOrder.city}</p><p><b>Isporuka:</b> {activeOrder.delivery}</p>
          </div>
          <table>
            <thead><tr><th className="col-rb">rb.</th><th>Šifra / artikal</th><th className="col-qty">Količina</th><th className="col-rb">✓</th></tr></thead>
            <tbody>{activeOrder.items.map((item, index) => <tr key={index}><td className="col-rb">{index + 1}</td><td>{item.article}</td><td className="col-qty"><b>{item.qty}</b></td><td className="col-rb">□</td></tr>)}</tbody>
          </table>
          {activeOrder.note && <p><b>Napomena:</b> {activeOrder.note}</p>}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <label><span>{label}</span>{children}</label>;
}
