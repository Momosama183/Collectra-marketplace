"use client";

export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Order = {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  total: number;
  payment_status: string;
  slip_url: string; 
  order_status: string;
  created_at: string;
};

export default function AdminPage() {
const ADMIN_PASSWORD = "allinadmin123";
const [password, setPassword] = useState("");
const [loggedIn, setLoggedIn] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  async function loadOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setOrders(data);
      console.log(data);
    }
  }

  async function updateStatus(
    id: string,
    newStatus: string
  ) {
    await supabase
      .from("orders")
      .update({
        order_status: newStatus,
      })
      .eq("id", id);

    loadOrders();
  }

  useEffect(() => {
    loadOrders();
  }, []);
if (!loggedIn) {
  return (
    <main className="section light">
      <div className="paymentBox">
        <h1>ALL IN Admin Login</h1>

        <p>Enter admin password</p>

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="navButton"
          onClick={() => {
            if (password === ADMIN_PASSWORD) {
              setLoggedIn(true);
            } else {
              alert("Wrong password");
            }
          }}
        >
          Login
        </button>
      </div>
    </main>
  );
}
  return (
    
    <main className="section light">
      <h1>ALL IN Admin</h1>

      {orders.map((order) => (
        <div
          key={order.id}
          className="paymentBox"
        >
          <h3>{order.customer_name}</h3>

          <p>{order.phone}</p>

          <p>{order.address}</p>

          <p>฿{order.total}</p>

          <p>
            Payment:
            {" "}
            {order.payment_status}
          </p>
{order.slip_url ? (
  <div>
    <p><b>Payment Slip:</b></p>
    <img
      src={order.slip_url}
      alt="Payment slip"
      style={{ width: "220px", borderRadius: "16px", marginTop: "10px" }}
    />
    <br />
    <a href={order.slip_url} target="_blank" rel="noreferrer">
      Open full slip
    </a>
  </div>
) : (
  <p>No payment slip uploaded yet.</p>
)}
          <p>
            Status:
            {" "}
            {order.order_status}
          </p>

          <button
            onClick={() =>
              updateStatus(
                order.id,
                "Packing"
              )
            }
          >
            Packing
          </button>

          <button
            onClick={() =>
              updateStatus(
                order.id,
                "Shipped"
              )
            }
          >
            Shipped
          </button>

          <button
            onClick={() =>
              updateStatus(
                order.id,
                "Cancelled"
              )
            }
          >
            Cancel
          </button>
        </div>
      ))}
    </main>
  );
}