"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Category = "K-pop" | "T-pop";

type Member = {
  name: string;
  price: number;
};

type Album = {
  category: Category;
  group: string;
  album: string;
  basePrice: number;
  versions: string[];
  members: Member[];
  image: string;
  note?: string;
  memberSelection?: boolean;
};

type CartItem = {
  id: number;
  category: Category;
  group: string;
  album: string;
  version: string;
  sorting: string;
  member: string;
  supplies: boolean;
  total: number;
};

const SUPPLIES_PRICE = 40;

const albums: Album[] = [
  {
    category: "K-pop",
    group: "BTS",
    album: "BTS ARIRANG",
    basePrice: 920,
    versions: ["Rooted in Korea", "Rooted in Music"],
    image: "/albums/bts.jpg",
    members: [
      { name: "Random", price: 0 },
      { name: "RM", price: 30 },
      { name: "Jin", price: 40 },
      { name: "Suga", price: 50 },
      { name: "j-hope", price: 30 },
      { name: "Jimin", price: 70 },
      { name: "V", price: 70 },
      { name: "Jungkook", price: 70 },
    ],
    note: "All member option includes album + PC.",
  },
  {
    category: "K-pop",
    group: "ENHYPEN",
    album: 'ROMANCE : UNTOLD',
    basePrice: 780,
    versions: ["INCEPTIO", "ARCANUM", "CONCESSIO"],
    image: "/albums/enhypen.webp",
    members: [
      { name: "Random", price: 0 },
      { name: "Jungwon", price: 40 },
      { name: "Jay", price: 30 },
      { name: "Jake", price: 50 },
      { name: "Sunghoon", price: 40 },
      { name: "Sunoo", price: 30 },
      { name: "Ni-ki", price: 50 },
    ],
    note: "Heeseung not included.",
  },
  {
    category: "K-pop",
    group: "ATEEZ",
    album: "THE WORLD EP.2 : OUTLAW",
    basePrice: 680,
    versions: ["A", "Diary", "Z"],
    image: "/albums/ateeze.jpg",
    members: [
      { name: "Random", price: 0 },
      { name: "Hongjoong", price: 50 },
      { name: "Seonghwa", price: 50 },
      { name: "Yunho", price: 30 },
      { name: "Yeosang", price: 20 },
      { name: "San", price: 50 },
      { name: "Mingi", price: 50 },
      { name: "Wooyoung", price: 50 },
      { name: "Jongho", price: 20 },
    ],
    note: "All member option includes album + PC.",
  },
  {
    category: "K-pop",
    group: "SEVENTEEN",
    album: "17 IS RIGHT HERE",
    basePrice: 960,
    versions: ["HERE", "HEAR"],
    image: "/albums/seventeen.jpg",
    members: [
      { name: "Random", price: 0 },
      { name: "S.Coups", price: 40 },
      { name: "Jeonghan", price: 50 },
      { name: "Joshua", price: 40 },
      { name: "Jun", price: 30 },
      { name: "Hoshi", price: 50 },
      { name: "Wonwoo", price: 50 },
      { name: "Woozi", price: 40 },
      { name: "DK", price: 30 },
      { name: "Mingyu", price: 50 },
      { name: "The8", price: 40 },
      { name: "Seungkwan", price: 30 },
      { name: "Vernon", price: 40 },
      { name: "Dino", price: 30 },
    ],
  },
  {
    category: "K-pop",
    group: "TREASURE",
    album: "NEW WAY",
    basePrice: 590,
    versions: ["Ice", "Red"],
    image: "/albums/treasure.webp",
    members: [
      { name: "Choi Hyunsuk", price: 40 },
      { name: "Jihoon", price: 40 },
      { name: "Yoshi", price: 20 },
      { name: "Junkyu", price: 58 },
      { name: "Yoon Jaehyuk", price: 30 },
      { name: "Asahi", price: 58 },
      { name: "Doyoung", price: 38 },
      { name: "Haruto", price: 20 },
      { name: "Park Jeongwoo", price: 0 },
      { name: "So Junghwan", price: 0 },
    ],
    note: "No random PC. Only member selection.",
  },
  {
    category: "K-pop",
    group: "Stray Kids",
    album: "SKZ THE 4TH ALBUM",
    basePrice: 760,
    versions: ["CEREMONY", "HOORAY"],
    image: "/albums/straykids.webp",
    members: [
      { name: "Random", price: 0 },
      { name: "Bang Chan", price: 40 },
      { name: "Lee Know", price: 40 },
      { name: "Changbin", price: 20 },
      { name: "Hyunjin", price: 50 },
      { name: "Han", price: 30 },
      { name: "Felix", price: 50 },
      { name: "Seungmin", price: 30 },
      { name: "I.N", price: 20 },
    ],
  },
  {
    category: "K-pop",
    group: "TWICE",
    album: "With YOU-th",
    basePrice: 790,
    versions: ["FOREVER", "GLOWING", "BLAST"],
    image: "/albums/twice.jpg",
    members: [
      { name: "Random", price: 0 },
      { name: "Nayeon", price: 60 },
      { name: "Jeongyeon", price: 40 },
      { name: "Momo", price: 50 },
      { name: "Sana", price: 60 },
      { name: "Jihyo", price: 50 },
      { name: "Mina", price: 50 },
      { name: "Dahyun", price: 40 },
      { name: "Chaeyoung", price: 40 },
      { name: "Tzuyu", price: 40 },
    ],
  },
  {
    category: "K-pop",
    group: "BABYMONSTER",
    album: "DRIP",
    basePrice: 820,
    versions: ["ZIP LOCK", "BINDER"],
    image: "/albums/babymonster.jpg",
    memberSelection: false,
    members: [
      { name: "All photocards included", price: 0 },
    ],
    note: "No member selection. All photocards included.",
  },
  {
    category: "K-pop",
    group: "BLACKPINK",
    album: "THE ALBUM",
    basePrice: 690,
    versions: ["Version 1", "Version 2", "Version 3", "Version 4"],
    image: "/albums/blackpink.jpg",
    members: [
      { name: "Random", price: 0 },
      { name: "Jisoo", price: 50 },
      { name: "Jennie", price: 50 },
      { name: "Rosé", price: 56 },
      { name: "Lisa", price: 50 },
    ],
  },
  {
    category: "T-pop",
    group: "LYKN",
    album: "DUSK & DAWN",
    basePrice: 1520,
    versions: ["Only Version"],
    image: "/albums/lykn.jpg",
    members: [
      { name: "Random", price: 0 },
      { name: "Nut", price: 40 },
      { name: "Hong", price: 20 },
      { name: "Tui", price: 30 },
      { name: "William", price: 50 },
      { name: "Lego", price: 40 },
    ],
  },
  {
    category: "T-pop",
    group: "BUS",
    album: "BECAUSE OF YOU I SHINE",
    basePrice: 1250,
    versions: ["WARM RAY SHINE", "STAR LIGHT SHINE"],
    image: "/albums/bus.webp",
    members: [
      { name: "Random", price: 0 },
      { name: "Alan", price: 40 },
      { name: "Marckris", price: 40 },
      { name: "Khunpol", price: 40 },
      { name: "Heart", price: 30 },
      { name: "Jinwook", price: 30 },
      { name: "Thai", price: 50 },
      { name: "Nex", price: 50 },
      { name: "Phutatchai", price: 40 },
      { name: "Copper", price: 30 },
      { name: "AA", price: 30 },
      { name: "Jungt", price: 50 },
      { name: "Peemwasu", price: 50 },
    ],
  },
  {
    category: "T-pop",
    group: "PiXXiE",
    album: "BLOOM",
    basePrice: 820,
    versions: ["Standard"],
    image: "/albums/pixxie.webp",
    members: [
      { name: "Random", price: 0 },
      { name: "Mabel", price: 30 },
      { name: "Pimma", price: 30 },
      { name: "Ingkho", price: 30 },
    ],
  },
  {
    category: "T-pop",
    group: "PROXIE",
    album: "LEVEL UP",
    basePrice: 1430,
    versions: ["Standard"],
    image: "/albums/proxie.jpg",
    members: [
      { name: "Random", price: 0 },
      { name: "Gun", price: 40 },
      { name: "Kim", price: 20 },
      { name: "Chokun", price: 30 },
      { name: "Gorn", price: 40 },
      { name: "Onglee", price: 30 },
      { name: "Victor", price: 20 },
    ],
  },
  {
    category: "T-pop",
    group: "CLO’VER",
    album: "No album yet",
    basePrice: 0,
    versions: ["Coming Soon"],
    image: "/albums/unreleased.jpg",
    members: [
      { name: "Barcode", price: 0 },
      { name: "Keen", price: 0 },
      { name: "Ashi", price: 0 },
      { name: "Aungpao", price: 0 },
    ],
    note: "Not yet have album.",
  },
  {
    category: "T-pop",
    group: "JASP.ER",
    album: "No album yet",
    basePrice: 0,
    versions: ["Coming Soon"],
    image: "/albums/unreleased.jpg",
    members: [
      { name: "Joong", price: 0 },
      { name: "Santa", price: 0 },
      { name: "Pond", price: 0 },
      { name: "Aou", price: 0 },
    ],
    note: "Not yet have album.",
  },
 
];

export default function Home() {
  const [category, setCategory] = useState<Category>("K-pop");
  const [selectedAlbum, setSelectedAlbum] = useState<Album>(albums[0]);
  const [version, setVersion] = useState(albums[0].versions[0]);
  const [member, setMember] = useState(albums[0].members[0].name);
  const [sorting, setSorting] = useState("Random sorting");
  const [supplies, setSupplies] = useState(false);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [addressSubmitted, setAddressSubmitted] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [slipStatus, setSlipStatus] = useState("Waiting for payment slip");
  const [currentOrderId, setCurrentOrderId] = useState("");

  const filteredAlbums = useMemo(() => {
    return albums.filter((item) => {
      const matchesCategory = item.category === category;
      const q = search.toLowerCase();
      const matchesSearch =
        item.group.toLowerCase().includes(q) ||
        item.album.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [category, search]);

  const selectedMember = selectedAlbum.members.find((m) => m.name === member);
  const memberPrice = selectedMember?.price || 0;
  const itemTotal =
    selectedAlbum.basePrice + memberPrice + (supplies ? SUPPLIES_PRICE : 0);

  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

  function chooseCategory(nextCategory: Category) {
    const firstAlbum = albums.find((item) => item.category === nextCategory)!;
    setCategory(nextCategory);
    setSelectedAlbum(firstAlbum);
    setVersion(firstAlbum.versions[0]);
    setMember(firstAlbum.members[0].name);
  }

  function chooseAlbum(album: Album) {
    setSelectedAlbum(album);
    setVersion(album.versions[0]);
    setMember(album.members[0].name);
  }

  function addToCart() {
    if (selectedAlbum.basePrice === 0) {
      alert("This album is not available yet.");
      return;
    }

    const newItem: CartItem = {
      id: Date.now(),
      category,
      group: selectedAlbum.group,
      album: selectedAlbum.album,
      version,
      sorting,
      member,
      supplies,
      total: itemTotal,
    };

    setCart((prev) => [...prev, newItem]);
    alert("Added to cart");
  }

  function removeFromCart(id: number) {
    setCart((prev) => prev.filter((item) => item.id !== id));
  }

  async function confirmOrder() {
    if (cart.length === 0) {
      alert("Please add items to your cart first.");
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .insert([
        {
          customer_name: customerName,
          phone,
          address,
          comment,
          cart,
          total: cartTotal,
          payment_status: "pending",
          order_status: "pending",
        },
      ])
      .select("id")
      .single();

    if (error) {
      console.log(error);
      alert("Order failed. Check Supabase.");
      return;
    }

    setCurrentOrderId(data.id);
    setOrderConfirmed(true);

    setTimeout(() => {
      document.getElementById("shipping")?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    alert("Order saved.");
  }

  async function submitAddress() {
    if (!customerName.trim() || !phone.trim() || address.trim().length < 10) {
      alert("Please enter name, phone, and full delivery address.");
      return;
    }

    if (currentOrderId) {
      await supabase
        .from("orders")
        .update({
          customer_name: customerName,
          phone,
          address,
          comment,
        })
        .eq("id", currentOrderId);
    }

    setAddressSubmitted(true);

    setTimeout(() => {
      document.getElementById("payment")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  async function handleSlipUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!currentOrderId) {
      alert("Please confirm your order before uploading payment slip.");
      return;
    }

    const fileName = `slip-${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("payment slips")
      .upload(fileName, file);

    if (error) {
      console.log(error);
      setSlipStatus("Slip upload failed. Please try again.");
      return;
    }

    const { data } = supabase.storage
      .from("payment slips")
      .getPublicUrl(fileName);

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        slip_url: data.publicUrl,
        payment_status: "slip uploaded",
      })
      .eq("id", currentOrderId);

    if (updateError) {
      console.log(updateError);
      setSlipStatus("Slip uploaded but order was not updated.");
      return;
    }

    setSlipStatus("Slip uploaded successfully. Waiting for verification.");
  }

  return (
    <main>
      <nav className="navbar">
        <a href="/" style={{ textDecoration: "none" }}>
        <div className="logo" style={{ display: "flex", alignItems: "center" }}>
<img src="/logo.png" alt="Collectra" style={{ height: 120, width: "auto" }} />
</div>
</a>
        <div className="navLinks">
          <a href="#order">Order</a>
          <a href="#cart">Cart</a>
          <a href="#shipping">Shipping</a>
          <a href="#payment">Payment</a>
          <a href="#tracking">Tracking</a>
          <a href="#contact">Contact</a>
          <a href="/verify">Verify Card</a>
          <a href="/packaging">Packaging Check</a>
        </div>

        <a href="#order" className="navButton">
          Start Order
        </a>
      </nav>

      <section className="hero">
        <div className="heroContent">
          <p className="tag">FULL-CYCLE FAN SUPPORT SYSTEM</p>
          <h1>From pre-order to your binder.</h1>
          <p className="subtitle">
            Join group orders, choose album versions, request random or member
            sorting, add card protection, pay by PromptPay, and track your order.
          </p>

          <div className="heroButtons">
  <a href="#order" className="primary">
    Start Ordering
  </a>
  <a href="/verify" className="secondary">
    Verify a Card
  </a>
  <a href="/packaging" className="secondary">
  Check Packaging
</a>
  <a href="#contact" className="secondary">
    Contact Admins
  </a>
</div>
        </div>
      </section>

      <section className="section" id="order">
        <p className="tag center">CREATE ORDER</p>
        <h2>Choose category, group, album, and sorting.</h2>

        <div className="tabs">
          <button
            className={category === "K-pop" ? "activeTab" : ""}
            onClick={() => chooseCategory("K-pop")}
          >
            K-pop
          </button>
          <button
            className={category === "T-pop" ? "activeTab" : ""}
            onClick={() => chooseCategory("T-pop")}
          >
            T-pop
          </button>
        </div>

        <input
          className="searchInput"
          placeholder="Search group or album..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="albumGrid">
          {filteredAlbums.map((album) => (
            <button
              key={`${album.category}-${album.group}-${album.album}`}
              className={
                selectedAlbum.group === album.group &&
                selectedAlbum.album === album.album
                  ? "albumCard selectedCard"
                  : "albumCard"
              }
              onClick={() => chooseAlbum(album)}
            >
              <img
                src={album.image}
                alt={album.group}
                className="albumImage"
              />
              <h3>{album.group}</h3>
              <p>{album.album}</p>
              <b>{album.basePrice > 0 ? `฿${album.basePrice}` : "Coming Soon"}</b>
              {album.note && <small>{album.note}</small>}
            </button>
          ))}
        </div>

        <div className="orderBox">
          <h3>{selectedAlbum.group}</h3>
          <p>{selectedAlbum.album}</p>

          <label>Album version</label>
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            {selectedAlbum.versions.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>

          <label>Sorting option</label>
          <select value={sorting} onChange={(e) => setSorting(e.target.value)}>
            <option>Random sorting</option>
            <option>Member sorting</option>
          </select>

          <label>Bias / member</label>
          <select
            value={member}
            onChange={(e) => setMember(e.target.value)}
            disabled={selectedAlbum.memberSelection === false}
          >
            {selectedAlbum.members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} {m.price > 0 ? `+ ฿${m.price}` : ""}
              </option>
            ))}
          </select>

          <label className="checkboxLine">
            <input
              type="checkbox"
              checked={supplies}
              onChange={(e) => setSupplies(e.target.checked)}
            />
            Sleeve + top loader set (+฿40)
          </label>

          <div className="priceLine">
            <span>Total for this item</span>
            <b>฿{itemTotal}</b>
          </div>

          <button className="fullButton" onClick={addToCart}>
            Add to Cart
          </button>
        </div>
      </section>

      <section className="section light" id="cart">
        <p className="tag center">CART</p>
        <h2>Review your order.</h2>

        <div className="cartBox">
          {cart.length === 0 && <p>Your cart is empty.</p>}

          {cart.map((item) => (
            <div className="cartItem" key={item.id}>
              <div>
                <h3>{item.group}</h3>
                <p>{item.album}</p>
                <p>{item.version}</p>
                <p>
                  {item.sorting} — {item.member}
                </p>
                {item.supplies && <p>Sleeve + top loader included</p>}
              </div>

              <div>
                <b>฿{item.total}</b>
                <button onClick={() => removeFromCart(item.id)}>Remove</button>
              </div>
            </div>
          ))}

          <div className="priceLine">
            <span>Delivery fee</span>
            <b>To be confirmed</b>
          </div>

          <div className="totalLine">
            <span>Total before delivery</span>
            <b>฿{cartTotal}</b>
          </div>

          <button className="fullButton" onClick={confirmOrder}>
            Confirm Order / Correct Order
          </button>
        </div>
      </section>

      <section
        className={orderConfirmed ? "section light" : "section light locked"}
        id="shipping"
      >
        <p className="tag center">DELIVERY ADDRESS</p>
        <h2>Enter delivery details.</h2>

        {!orderConfirmed && (
          <p className="lockedText">
            Confirm your cart first before entering delivery address.
          </p>
        )}

        {orderConfirmed && (
          <div className="orderBox">
            <label>Name</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
            />

            <label>Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
            />

            <label>Delivery address</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full delivery address"
            />

            <label>Comment / request</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Extra comments, member request, admin question..."
            />

            <p>Shipping usually takes 5–7 days after items are shipped.</p>

            <button className="fullButton" onClick={submitAddress}>
              Enter Address
            </button>
          </div>
        )}
      </section>

      <section
        className={addressSubmitted ? "section" : "section locked"}
        id="payment"
      >
        <p className="tag center">PROMPTPAY CHECKOUT</p>
        <h2>PromptPay QR + slip verification.</h2>

        {!addressSubmitted && (
          <p className="lockedText">Enter delivery address first to unlock payment.</p>
        )}

        {addressSubmitted && (
          <div className="paymentBox">
            <img
              src="/albums/scan.JPG?v=1"
              alt="PromptPay QR"
              className="qrImage"
            />

            <h3>COLLECTRA</h3>
            <p>Payment method: PromptPay QR only</p>
            <p>Amount to pay before delivery: ฿{cartTotal}</p>

            <label>Upload payment slip</label>
            <input type="file" accept="image/*" onChange={handleSlipUpload} />
{slipStatus.includes("uploaded") && (
  <button
    className="navButton"
    onClick={() => {
      alert("Payment slip submitted successfully. Admin will review shortly.");
    }}
  >
    Done
  </button>
)}
            <div className="statusBox">{slipStatus}</div>

            <p className="smallNote">
              Admins can review uploaded slips from the private admin dashboard.
            </p>
          </div>
        )}
      </section>

      <section className="section light" id="tracking">
        <p className="tag center">TRACKING</p>
        <h2>Tracking after shipping.</h2>
        <p>
          Once your item has been shipped, admins will update the order status and
          tracking code in the private admin dashboard.
        </p>
      </section>

      <section className="section" id="contact">
        <p className="tag center">CONTACT</p>
        <h2>Contact admins.</h2>
        <p>
          For questions, payment issues, address changes, or order edits, message
          the ALL IN admins directly through our instagram all_in._.official .
        </p>
      </section>

      <footer>
        <h3>ALL IN</h3>
        <p>
          Pre-order hub, album sorting, card protection, PromptPay checkout,
          tracking, and admin order review.
        </p>
      </footer>
    </main>
  );
}