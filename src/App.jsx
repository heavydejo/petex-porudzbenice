
import React, { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mlnmbdlgraxeclhqbyct.supabase.co";
const supabaseKey = "sb_publishable_FEKbD8TuoPqyZ4TM_Ci27A_T9ReJNaz";
const supabase = createClient(supabaseUrl, supabaseKey);

const emptyItems = Array.from({ length: 10 }, () => ({ article: "", qty: "", picked: false }));

function makeOrderNumber(count) {
  const year = new Date().getFullYear();
  return `${year}-${String(count + 1).padStart(4, "0")}`;
}

export default function App() {
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("form");
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
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

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      alert("Greška pri čitanju porudžbina: " + error.message);
      return;
    }

    const normalized = (data || []).map((o) => ({
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
    }));

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

  async function saveOrder() {
    if (!form.buyer.trim()) return alert("Unesi kupca.");
    if (filledItems.length === 0) return alert("Unesi makar jednu stavku robe.");

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

    const { data, error } = await supabase
      .from("orders")
      .insert(payload)
      .select()
      .single();

    setLoading(false);

    if (error) {
      alert("Greška pri čuvanju: " + error.message);
      return;
    }

    const order = {
      id: data.id,
      orderNo: data.order_no,
      buyer: data.buyer,
      phone: data.phone || "",
      city: data.city || "",
      delivery: data.delivery || "DA",
      date: data.order_date,
      note: data.note || "",
      status: data.status || "Nova",
      items: data.items || [],
      createdAt: data.created_at,
    };

    setOrders([order, ...orders]);
    setSelectedOrder(order);
    setView("print");

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

    if (error) {
      alert("Greška pri brisanju: " + error.message);
      return;
    }

    const updated = orders.filter((o) => o.id !== id);
    setOrders(updated);
    if (selectedOrder?.id === id) setSelectedOrder(null);
  }

  async function togglePicked(order, index) {
    const items = [...order.items];
    items[index] = { ...items[index], picked: !items[index].picked };
    const status = items.every((i) => i.picked) ? "Izdvojeno" : "U obradi";

    const { error } = await supabase
      .from("orders")
      .update({ items, status })
      .eq("id", order.id);

    if (error) {
      alert("Greška pri ažuriranju: " + error.message);
      return;
    }

    const updatedOrders = orders.map((o) =>
      o.id === order.id ? { ...o, items, status } : o
    );

    setOrders(updatedOrders);
    setSelectedOrder({ ...order, items, status });
  }

  const activeOrder = selectedOrder || orders[0];

  return (
    <div className="page">
      <style>{`
        body {
          margin: 0;
          background: #f3f4f6;
          font-family: Arial, sans-serif;
          color: #111827;
        }
        .page {
          padding: 20px;
          max-width: 1100px;
          margin: auto;
        }
        .top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }
        .card {
          background: white;
          border-radius: 16px;
          padding: 20px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
          margin-bottom: 20px;
        }
        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        label {
          font-size: 14px;
          font-weight: bold;
        }
        input, select {
          width: 100%;
          box-sizing: border-box;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid #ccc;
          margin-top: 5px;
        }
        button {
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          margin: 4px;
        }
        .black {
          background: black;
          color: white;
        }
        .white {
          background: white;
          border: 1px solid #ccc;
        }
        .danger {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ccc;
          padding: 10px;
          text-align: left;
        }
        th {
          background: #f3f4f6;
        }
        .order-row {
          border-bottom: 1px solid #ddd;
          padding: 12px 0;
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: center;
        }
        .pick-row {
          width: 100%;
          text-align: left;
          border: 1px solid #ddd;
          background: white;
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .picked {
          background: #e5e7eb;
        }
        @media(max-width: 700px) {
          .grid, .top {
            grid-template-columns: 1fr;
            display: block;
          }
          .order-row {
            display: block;
          }
        }
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white;
          }
          .page {
            max-width: none;
            padding: 0;
          }
          .card {
            box-shadow: none;
            border-radius: 0;
          }
        }
      `}</style>

      <div className="top no-print">
        <div>
          <h1>Digitalna porudžbenica</h1>
          <p>Online verzija povezana sa Supabase bazom.</p>
        </div>
        <div>
          <button className="black" onClick={() => setView("form")}>Nova porudžbenica</button>
          <button className="white" onClick={() => { setView("admin"); loadOrders(); }}>Admin pregled</button>
        </div>
      </div>

      {loading && <div className="card no-print">Učitavanje...</div>}

      {view === "form" && (
        <div className="card no-print">
          <h2>Nova porudžbenica</h2>

          <div className="grid">
            <div>
              <label>Porudžbenica br.</label>
              <input value={form.orderNo} onChange={(e) => setForm({ ...form, orderNo: e.target.value })} />
            </div>

            <div>
              <label>Datum</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>

            <div>
              <label>Kupac *</label>
              <input value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} />
            </div>

            <div>
              <label>Telefon</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div>
              <label>Grad</label>
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>

            <div>
              <label>Isporuka</label>
              <select value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })}>
                <option>DA</option>
                <option>NE</option>
              </select>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{width: "60px"}}>rb.</th>
                <th>Šifra / Naziv artikla</th>
                <th style={{width: "120px"}}>Količina</th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      placeholder="npr. MAG-KOTOR / Magnet Kotor"
                      value={item.article}
                      onChange={(e) => updateItem(index, "article", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      value={item.qty}
                      onChange={(e) => updateItem(index, "qty", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{marginTop: 15}}>
            <label>Napomena</label>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>

          <div style={{ marginTop: 20 }}>
            <button className="white" onClick={addRows}>Dodaj redove</button>
            <button className="black" onClick={saveOrder}>Sačuvaj porudžbenicu</button>
          </div>
        </div>
      )}

      {view === "admin" && (
        <div className="card no-print">
          <h2>Admin pregled</h2>
          {orders.length === 0 && <p>Nema porudžbina.</p>}

          {orders.map((order) => (
            <div className="order-row" key={order.id}>
              <div>
                <b>#{order.orderNo} — {order.buyer}</b><br />
                <small>{order.date} · {order.city || "bez grada"} · Isporuka: {order.delivery} · Stavki: {order.items.length} · Status: <b>{order.status}</b></small>
              </div>
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
            <button
              key={index}
              className={"pick-row " + (item.picked ? "picked" : "")}
              onClick={() => togglePicked(activeOrder, index)}
            >
              <span><b>{index + 1}.</b> {item.article}</span>
              <span><b>{item.qty}</b> {item.picked ? "✓" : ""}</span>
            </button>
          ))}

          <button className="white" onClick={() => setView("admin")}>Nazad</button>
          <button className="black" onClick={() => setView("print")}>Otvori za štampu</button>
        </div>
      )}

      {view === "print" && activeOrder && (
        <div className="card">
          <div className="no-print">
            <button className="white" onClick={() => setView("admin")}>Nazad</button>
            <button className="black" onClick={() => window.print()}>Štampaj</button>
          </div>

          <div style={{display: "flex", justifyContent: "space-between", borderBottom: "1px solid #ddd", paddingBottom: 15}}>
            <div>
              <h2>PETEX SUVENIRI</h2>
              <p>Porudžbenica robe</p>
            </div>
            <div>
              <p><b>Br:</b> {activeOrder.orderNo}</p>
              <p><b>Datum:</b> {activeOrder.date}</p>
            </div>
          </div>

          <div className="grid" style={{marginTop: 15}}>
            <p><b>Kupac:</b> {activeOrder.buyer}</p>
            <p><b>Telefon:</b> {activeOrder.phone}</p>
            <p><b>Grad:</b> {activeOrder.city}</p>
            <p><b>Isporuka:</b> {activeOrder.delivery}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>rb.</th>
                <th>Šifra / Naziv artikla</th>
                <th>Količina</th>
                <th>Izdv.</th>
              </tr>
            </thead>
            <tbody>
              {activeOrder.items.map((item, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{item.article}</td>
                  <td><b>{item.qty}</b></td>
                  <td>□</td>
                </tr>
              ))}
            </tbody>
          </table>

          {activeOrder.note && <p><b>Napomena:</b> {activeOrder.note}</p>}
        </div>
      )}
    </div>
  );
}
