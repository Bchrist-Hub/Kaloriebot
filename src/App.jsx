import { useState, useMemo, useCallback, useEffect } from "react";
import { FOODS } from "./foods.js";

// Persist state to localStorage
function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem("kalorie_" + key);
      return stored !== null ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("kalorie_" + key, JSON.stringify(state));
    } catch { /* ignore quota errors */ }
  }, [key, state]);

  return [state, setState];
}

const ACTIVITY_LEVELS = [
  { id: "sedentary", label: "Stillesiddende", desc: "Lidt eller ingen motion", factor: 1.2 },
  { id: "light", label: "Let aktiv", desc: "Let motion 1-3 dage/uge", factor: 1.375 },
  { id: "moderate", label: "Moderat aktiv", desc: "Moderat motion 3-5 dage/uge", factor: 1.55 },
  { id: "active", label: "Meget aktiv", desc: "Hård motion 6-7 dage/uge", factor: 1.725 },
  { id: "extreme", label: "Ekstremt aktiv", desc: "Meget hård motion, fysisk arbejde", factor: 1.9 },
];

const BMI_CATS = [
  { max: 18.5, label: "Undervægtig", color: "#5BA4CF" },
  { max: 25, label: "Normalvægtig", color: "#66BB6A" },
  { max: 30, label: "Overvægtig", color: "#FFA726" },
  { max: 100, label: "Svær overvægt", color: "#EF5350" },
];

const MEALS = [
  { id: "breakfast", label: "Morgenmad", icon: "☀", color: "#FFA726" },
  { id: "lunch", label: "Frokost", icon: "☀", color: "#66BB6A" },
  { id: "dinner", label: "Aftensmad", icon: "☾", color: "#5BA4CF" },
  { id: "snack", label: "Snacks", icon: "✦", color: "#AB7AE0" },
];

function getBmiCat(bmi) { return BMI_CATS.find(c => bmi < c.max) || BMI_CATS[3]; }
function calcBMR(w, h, a, sex) { return sex === "male" ? 10*w + 6.25*h - 5*a + 5 : 10*w + 6.25*h - 5*a - 161; }
function calcBMI(wKg, hCm) { const w = parseFloat(wKg), hm = parseFloat(hCm)/100; return w > 0 && hm > 0 ? w/(hm*hm) : null; }

export default function App() {
  const [firstName, setFirstName] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState("male");
  const [activity, setActivity] = usePersistedState("activity", "moderate");
  const [profileSaved, setProfileSaved] = usePersistedState("profileSaved", false);
  const [savedProfile, setSavedProfile] = usePersistedState("savedProfile", null);
  const [entries, setEntries] = usePersistedState("entries", []);
  const [search, setSearch] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [amount, setAmount] = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const [tab, setTab] = useState("log");
  const [customName, setCustomName] = useState("");
  const [customCal, setCustomCal] = useState("");
  const [customAmt, setCustomAmt] = useState("");
  const [validationErr, setValidationErr] = useState("");
  const [favorites, setFavorites] = usePersistedState("favorites", []);
  const [recentFoods, setRecentFoods] = usePersistedState("recentFoods", []);
  const [foodTab, setFoodTab] = useState("search");
  const [selectedMeal, setSelectedMeal] = useState("breakfast");
  const [expandedMeals, setExpandedMeals] = useState({ breakfast: true, lunch: true, dinner: true, snack: true });
  const [expandedHistDays, setExpandedHistDays] = useState({});
  const [weightLogs, setWeightLogs] = usePersistedState("weightLogs", []);
  const [newWeight, setNewWeight] = useState("");
  const [showResetModal, setShowResetModal] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return FOODS.slice(0, 10);
    const searchWords = search.toLowerCase().split(/\s+/).filter(Boolean);

    // Tokenize a food name into individual words
    const tokenize = (name) => name.toLowerCase().split(/[\s,()\/\-]+/).filter(Boolean);

    // Check if a search word matches any token at word boundary (token starts with search word)
    const wordMatches = (tokens, sw) => tokens.some(t => t.startsWith(sw));

    // Score: higher = better match
    const score = (food) => {
      const tokens = tokenize(food.n);
      let s = 0;
      for (const sw of searchWords) {
        const exactMatch = tokens.some(t => t === sw);
        const startMatch = tokens.some(t => t.startsWith(sw));
        if (exactMatch) s += 10;
        else if (startMatch) s += 5;
        else return -1; // search word not found at all — exclude
        // Bonus if match is in first token (i.e. main food name)
        if (tokens[0].startsWith(sw)) s += 3;
      }
      // Shorter names rank higher (more specific)
      s += Math.max(0, 5 - Math.floor(food.n.length / 15));
      return s;
    };

    const results = [];
    for (const food of FOODS) {
      const s = score(food);
      if (s > 0) results.push({ food, score: s });
    }
    results.sort((a, b) => b.score - a.score);
    return results.map(r => r.food).slice(0, 30);
  }, [search]);

  const bmi = savedProfile ? calcBMI(savedProfile.weight, savedProfile.height) : null;
  const bmr = useMemo(() => {
    if (!savedProfile) return null;
    return calcBMR(savedProfile.weight, savedProfile.height, savedProfile.age, savedProfile.sex);
  }, [savedProfile]);

  const actFactor = ACTIVITY_LEVELS.find(a => a.id === activity)?.factor || 1.55;
  const tdee = bmr ? Math.round(bmr * actFactor) : null;
  const todayStr = new Date().toLocaleDateString("da-DK");
  const todayEntries = entries.filter(e => e.date === todayStr);
  const todayCal = todayEntries.reduce((s, e) => s + e.calories, 0);

  const mealBreakdown = useMemo(() => {
    const bd = {};
    MEALS.forEach(m => { bd[m.id] = { entries: [], cal: 0 }; });
    todayEntries.forEach(e => {
      const mid = e.meal || "snack";
      if (!bd[mid]) bd[mid] = { entries: [], cal: 0 };
      bd[mid].entries.push(e);
      bd[mid].cal += e.calories;
    });
    return bd;
  }, [todayEntries]);

  const allDays = useMemo(() => {
    const days = {};
    entries.forEach(e => { if (!days[e.date]) days[e.date] = []; days[e.date].push(e); });
    return Object.entries(days).sort((a, b) => {
      const pA = a[0].split("."), pB = b[0].split(".");
      return new Date(pB[2], pB[1]-1, pB[0]) - new Date(pA[2], pA[1]-1, pA[0]);
    });
  }, [entries]);

  // Auto-suggest meal based on time of day
  function suggestMeal() {
    const h = new Date().getHours();
    if (h < 10) return "breakfast";
    if (h < 14) return "lunch";
    if (h < 18) return "dinner";
    if (h < 21) return "snack";
    return "snack";
  }

  function toggleFavorite(foodName) {
    setFavorites(prev => prev.includes(foodName) ? prev.filter(f => f !== foodName) : [...prev, foodName]);
  }
  function isFav(foodName) { return favorites.includes(foodName); }

  function addToRecent(food) {
    setRecentFoods(prev => {
      const f = prev.filter(ff => ff.n !== food.n);
      return [food, ...f].slice(0, 15);
    });
  }

  function selectFood(food) {
    setSelectedFood(food);
    setSearch(food.n);
    setAmount("100");
    setSelectedMeal(suggestMeal());
    setShowDrop(false);
  }

  function saveProfile() {
    if (!firstName.trim()) { setValidationErr("Indtast dit fornavn"); return; }
    const w = parseFloat(weight), h = parseFloat(height), a = parseFloat(age);
    if (!w || w <= 0 || w > 500) { setValidationErr("Indtast en gyldig vægt (1-500 kg)"); return; }
    if (!h || h < 50 || h > 280) { setValidationErr("Indtast en gyldig højde (50-280 cm)"); return; }
    if (!a || a < 1 || a > 130) { setValidationErr("Indtast en gyldig alder (1-130 år)"); return; }
    const testBmi = calcBMI(w, h);
    if (testBmi < 5 || testBmi > 100) { setValidationErr("Usandsynligt BMI (" + testBmi.toFixed(1) + "). Tjek dine værdier — højde i cm."); return; }
    setValidationErr("");
    setSavedProfile({ name: firstName.trim(), weight: w, height: h, age: a, sex });
    setProfileSaved(true);
  }

  function editProfile() {
    if (savedProfile) { setFirstName(savedProfile.name || ""); setWeight(String(savedProfile.weight)); setHeight(String(savedProfile.height)); setAge(String(savedProfile.age)); setSex(savedProfile.sex); }
    setProfileSaved(false); setValidationErr("");
  }

  function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          Object.entries(data).forEach(([key, value]) => {
            if (key.startsWith("kalorie_")) localStorage.setItem(key, JSON.stringify(value));
          });
          window.location.reload();
        } catch { setValidationErr("Ugyldig backup-fil"); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function addEntry() {
    if (!selectedFood || !amount || parseFloat(amount) <= 0) return;
    const cal = Math.round((selectedFood.c / 100) * parseFloat(amount));
    setEntries(prev => [...prev, {
      id: Date.now(), food: selectedFood.n, amount: parseFloat(amount), unit: "g",
      calories: cal, date: todayStr, meal: selectedMeal,
      time: new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }),
    }]);
    addToRecent(selectedFood);
    setSelectedFood(null); setAmount(""); setSearch("");
  }

  function addCustom() {
    if (!customName || !customCal || !customAmt) return;
    const cal = Math.round((parseFloat(customCal) / 100) * parseFloat(customAmt));
    const customFood = { n: customName, c: parseFloat(customCal) };
    setEntries(prev => [...prev, {
      id: Date.now(), food: customName, amount: parseFloat(customAmt), unit: "g",
      calories: cal, date: todayStr, meal: selectedMeal,
      time: new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" }),
    }]);
    addToRecent(customFood);
    setCustomName(""); setCustomCal(""); setCustomAmt("");
  }

  function removeEntry(id) { setEntries(prev => prev.filter(e => e.id !== id)); }

  function toggleMealExpand(mealId) {
    setExpandedMeals(prev => ({ ...prev, [mealId]: !prev[mealId] }));
  }

  function toggleHistDay(date) {
    setExpandedHistDays(prev => ({ ...prev, [date]: !prev[date] }));
  }

  const bmiCat = bmi ? getBmiCat(bmi) : null;
  const calPct = tdee ? Math.min((todayCal / tdee) * 100, 120) : 0;
  const profileValid = firstName.trim() && weight && height && age;
  const favFoods = useMemo(() => FOODS.filter(f => favorites.includes(f.n)), [favorites]);

  // Weight log functions
  function addWeightLog() {
    const w = parseFloat(newWeight);
    if (!w || w <= 0 || w > 500) return;
    const today = new Date().toLocaleDateString("da-DK");
    setWeightLogs(prev => {
      const existing = prev.findIndex(l => l.date === today);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], weight: w };
        return updated;
      }
      return [...prev, { date: today, weight: w, ts: Date.now() }];
    });
    setNewWeight("");
    setSavedProfile(prev => prev ? { ...prev, weight: w } : prev);
  }

  function removeWeightLog(ts) {
    setWeightLogs(prev => prev.filter(l => l.ts !== ts));
  }

  function exportData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("kalorie_")) data[key] = JSON.parse(localStorage.getItem(key));
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const profileName = savedProfile?.name ? `-${savedProfile.name.toLowerCase()}` : "";
    a.download = `kalorietaeller-backup${profileName}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function resetApp(keepData) {
    if (keepData) exportData();
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("kalorie_")) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  }

  const dailyCalories = useMemo(() => {
    const dc = {};
    entries.forEach(e => { dc[e.date] = (dc[e.date] || 0) + e.calories; });
    return dc;
  }, [entries]);

  const graphData = useMemo(() => {
    if (weightLogs.length === 0) return [];
    const sorted = [...weightLogs].sort((a, b) => a.ts - b.ts);
    return sorted.map(l => ({ ...l, cal: dailyCalories[l.date] || null }));
  }, [weightLogs, dailyCalories]);

  // Weekly stats: rolling 7-day calorie data + per-day bars
  const weeklyStats = useMemo(() => {
    const today = new Date();
    const days = [];
    const dayNames = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("da-DK");
      const cal = dailyCalories[dateStr] || 0;
      days.push({
        date: dateStr,
        dayName: dayNames[d.getDay()],
        dayNum: d.getDate(),
        cal,
        isToday: i === 0,
      });
    }
    const daysWithData = days.filter(d => d.cal > 0);
    const avg = daysWithData.length > 0 ? Math.round(daysWithData.reduce((s, d) => s + d.cal, 0) / daysWithData.length) : 0;
    const total = days.reduce((s, d) => s + d.cal, 0);
    const maxCal = Math.max(...days.map(d => d.cal), 1);
    return { days, avg, total, daysWithData: daysWithData.length, maxCal };
  }, [dailyCalories]);

  const inputStyle = {
    width: "100%", padding: "11px 13px", background: "rgba(8,15,11,0.8)",
    border: "1px solid rgba(76,175,80,0.18)", borderRadius: 10,
    color: "#e0e8e2", fontSize: 15, fontFamily: "inherit", outline: "none",
    transition: "border-color 0.2s",
  };
  const cardStyle = {
    background: "linear-gradient(145deg, rgba(26,40,32,0.92) 0%, rgba(16,28,22,0.96) 100%)",
    borderRadius: 16, border: "1px solid rgba(76,175,80,0.1)",
    boxShadow: "0 2px 20px rgba(0,0,0,0.2), 0 0 40px rgba(76,175,80,0.04)",
  };

  const StarIcon = ({ filled, size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#FFA726" : "none"} stroke={filled ? "#FFA726" : "#5a7a5e"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );

  function FoodRow({ food, onSelect }) {
    return (
      <div className="fi" onClick={() => onSelect(food)}
        style={{ padding: "9px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(76,175,80,0.04)" }}>
        <span style={{ fontSize: 13, color: "#b8ccbb", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{food.n}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8 }}>
          <span style={{ fontSize: 11, color: "#4a7a50", whiteSpace: "nowrap" }}>{food.c} kcal</span>
          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(food.n); }}
            style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}>
            <StarIcon filled={isFav(food.n)} />
          </button>
        </div>
      </div>
    );
  }

  const mealPicker = (
    <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
      {MEALS.map(m => (
        <button key={m.id} onClick={() => setSelectedMeal(m.id)}
          style={{
            flex: 1, padding: "8px 4px", borderRadius: 9, cursor: "pointer",
            border: selectedMeal === m.id ? `1px solid ${m.color}50` : "1px solid rgba(76,175,80,0.08)",
            background: selectedMeal === m.id ? `${m.color}18` : "rgba(8,15,11,0.4)",
            fontFamily: "inherit", transition: "all 0.2s",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
          <span style={{ fontSize: 14 }}>{m.icon}</span>
          <span style={{ fontSize: 10, color: selectedMeal === m.id ? m.color : "#5a7a5e", fontWeight: selectedMeal === m.id ? 600 : 400 }}>{m.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(165deg, #060d09 0%, #0e1812 35%, #0a100d 70%, #080e0b 100%)",
      fontFamily: "'DM Sans', sans-serif", color: "#dce5de", padding: 0,
    }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0}
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        input[type=number]{-moz-appearance:textfield}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#1e3026;border-radius:3px}
        .fi:hover{background:rgba(76,175,80,0.1)!important}
        .er:hover{background:rgba(76,175,80,0.06)!important}
        .er:hover .rb{opacity:1}
        .rb{opacity:0;transition:opacity 0.2s}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .an{animation:fi 0.35s ease forwards}
        .act-btn{transition:all 0.25s ease}
        .act-btn:hover{border-color:rgba(76,175,80,0.35)!important}
        .ftab{transition:all 0.2s ease}
        .ftab:hover{color:#66BB6A!important}
        .mhdr{transition:background 0.2s}
        .mhdr:hover{background:rgba(76,175,80,0.04)!important}
        select{-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a9a80' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center}
      `}</style>

      <div style={{ maxWidth: 540, margin: "0 auto", padding: "20px 16px 90px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28, paddingTop: 12 }}>
          <div style={{ fontSize: 11, letterSpacing: 5, color: "#4CAF50", fontWeight: 500, textTransform: "uppercase", marginBottom: 4 }}>Næringstracker</div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 38, fontWeight: 400, color: "#e8ede9", letterSpacing: -0.5 }}>Kalorietæller</h1>
          <div style={{ fontSize: 12, color: "#5a7a5e", marginTop: 4 }}>{savedProfile?.name ? `Hej, ${savedProfile.name}` : `${FOODS.length} fødevarer fra Frida-databasen`}</div>
        </div>

        {!profileSaved ? (
          <div className="an" style={{ ...cardStyle, padding: 26, marginBottom: 20 }}>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, marginBottom: 20, color: "#c0d4c3", fontWeight: 400 }}>Din profil</h2>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Fornavn</label>
              <input type="text" placeholder="Dit fornavn" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle}
                onFocus={e => e.target.style.borderColor = "rgba(76,175,80,0.45)"} onBlur={e => e.target.style.borderColor = "rgba(76,175,80,0.18)"} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Vægt (kg)</label>
                <input type="number" placeholder="75" value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(76,175,80,0.45)"} onBlur={e => e.target.style.borderColor = "rgba(76,175,80,0.18)"} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Højde (cm)</label>
                <input type="number" placeholder="178" value={height} onChange={e => setHeight(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(76,175,80,0.45)"} onBlur={e => e.target.style.borderColor = "rgba(76,175,80,0.18)"} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Alder (år)</label>
                <input type="number" placeholder="30" value={age} onChange={e => setAge(e.target.value)} style={inputStyle}
                  onFocus={e => e.target.style.borderColor = "rgba(76,175,80,0.45)"} onBlur={e => e.target.style.borderColor = "rgba(76,175,80,0.18)"} />
              </div>
              <div>
                <label style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Køn</label>
                <select value={sex} onChange={e => setSex(e.target.value)} style={{ ...inputStyle, cursor: "pointer", paddingRight: 32 }}>
                  <option value="male">Mand</option>
                  <option value="female">Kvinde</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <label style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 8 }}>Aktivitetsniveau</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ACTIVITY_LEVELS.map(al => (
                  <button key={al.id} className="act-btn" onClick={() => setActivity(al.id)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                      background: activity === al.id ? "rgba(76,175,80,0.12)" : "rgba(8,15,11,0.5)",
                      border: activity === al.id ? "1px solid rgba(76,175,80,0.35)" : "1px solid rgba(76,175,80,0.08)",
                      color: "#dce5de", fontFamily: "inherit", textAlign: "left",
                    }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: activity === al.id ? 600 : 400, color: activity === al.id ? "#66BB6A" : "#b0c4b4" }}>{al.label}</div>
                      <div style={{ fontSize: 11, color: "#5a7a5e", marginTop: 1 }}>{al.desc}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#5a7a5e", fontWeight: 500 }}>×{al.factor}</div>
                  </button>
                ))}
              </div>
            </div>

            {validationErr && (
              <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(239,83,80,0.1)", border: "1px solid rgba(239,83,80,0.25)", color: "#EF5350", fontSize: 13 }}>{validationErr}</div>
            )}

            <button onClick={saveProfile} style={{
              width: "100%", marginTop: 20, padding: 14,
              background: profileValid ? "linear-gradient(135deg, #2e7d32, #43A047)" : "rgba(76,175,80,0.12)",
              border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 600,
              cursor: profileValid ? "pointer" : "default", fontFamily: "inherit",
            }}>Gem profil</button>

            <div style={{ textAlign: "center", marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(76,175,80,0.08)" }}>
              <div style={{ fontSize: 11, color: "#4a6a4e", marginBottom: 8 }}>Har du en tidligere backup?</div>
              <button onClick={importData} style={{
                background: "none", border: "1px solid rgba(76,175,80,0.15)", borderRadius: 10,
                padding: "10px 20px", color: "#5a7a5e", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              }}>Indlæs gemt data</button>
            </div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="an" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div style={{ ...cardStyle, padding: "18px 16px" }}>
                <div style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>BMI</div>
                <div style={{ fontSize: 30, fontWeight: 400, fontFamily: "'Instrument Serif', serif", color: bmiCat?.color || "#dce5de" }}>{bmi?.toFixed(1) || "—"}</div>
                {bmiCat && <div style={{ display: "inline-block", marginTop: 6, padding: "2px 9px", borderRadius: 20, fontSize: 10, fontWeight: 600, color: bmiCat.color, background: bmiCat.color + "15", border: `1px solid ${bmiCat.color}28` }}>{bmiCat.label}</div>}
                <div style={{ fontSize: 10, color: "#4a6a4e", marginTop: 6 }}>{savedProfile?.weight} kg · {savedProfile?.height} cm</div>
              </div>
              <div style={{ ...cardStyle, padding: "18px 16px" }}>
                <div style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>TDEE</div>
                <div style={{ fontSize: 30, fontWeight: 400, fontFamily: "'Instrument Serif', serif" }}>{tdee || "—"}</div>
                <div style={{ fontSize: 11, color: "#5a7a5e", marginTop: 2 }}>kcal/dag</div>
                <div style={{ fontSize: 10, color: "#4a6a4e", marginTop: 2 }}>BMR {bmr ? Math.round(bmr) : "—"} × {actFactor}</div>
              </div>
            </div>

            {/* Progress + meal breakdown */}
            <div className="an" style={{ ...cardStyle, padding: "18px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase" }}>Dagens indtag</div>
                <div>
                  <span style={{ fontSize: 26, fontWeight: 400, fontFamily: "'Instrument Serif', serif", color: todayCal > (tdee || 99999) ? "#FFA726" : "#66BB6A" }}>{todayCal}</span>
                  <span style={{ fontSize: 13, color: "#5a7a5e" }}> / {tdee || "—"} kcal</span>
                </div>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "rgba(76,175,80,0.08)", overflow: "hidden", marginBottom: 12 }}>
                <div style={{ height: "100%", width: `${Math.min(calPct, 100)}%`, borderRadius: 3, background: calPct > 100 ? "linear-gradient(90deg, #FFA726, #EF5350)" : "linear-gradient(90deg, #2e7d32, #66BB6A)", transition: "width 0.5s ease" }} />
              </div>

              {/* Meal breakdown bar */}
              {todayCal > 0 && (
                <div>
                  <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                    {MEALS.map(m => {
                      const mc = mealBreakdown[m.id]?.cal || 0;
                      const pct = todayCal > 0 ? (mc / todayCal) * 100 : 0;
                      if (pct === 0) return null;
                      return <div key={m.id} style={{ width: `${pct}%`, background: m.color, transition: "width 0.4s ease" }} />;
                    })}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                    {MEALS.map(m => {
                      const mc = mealBreakdown[m.id]?.cal || 0;
                      if (mc === 0) return null;
                      const pct = Math.round((mc / todayCal) * 100);
                      return (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />
                          <span style={{ fontSize: 11, color: "#8aa88e" }}>{m.label}</span>
                          <span style={{ fontSize: 11, color: "#5a7a5e" }}>{mc} kcal ({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {tdee && todayCal > 0 && (
                <div style={{ fontSize: 11, color: "#5a7a5e", marginTop: 8, textAlign: "right" }}>
                  {todayCal >= tdee ? `+${todayCal - tdee} kcal over dit daglige behov` : `${tdee - todayCal} kcal tilbage`}
                </div>
              )}
            </div>

            {/* Weekly overview */}
            {weeklyStats.daysWithData > 0 && (
              <div className="an" style={{ ...cardStyle, padding: "18px 16px", marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase" }}>Sidste 7 dage</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#5a7a5e" }}>Gns.</span>
                    <span style={{
                      fontSize: 20, fontWeight: 400, fontFamily: "'Instrument Serif', serif",
                      color: tdee && weeklyStats.avg > tdee ? "#FFA726" : "#66BB6A"
                    }}>{weeklyStats.avg}</span>
                    <span style={{ fontSize: 11, color: "#5a7a5e" }}>kcal/dag</span>
                  </div>
                </div>

                {/* Bar chart */}
                <div style={{ display: "flex", gap: 4, alignItems: "end", height: 100, marginBottom: 6 }}>
                  {weeklyStats.days.map((d, i) => {
                    const barMax = tdee ? Math.max(weeklyStats.maxCal, tdee * 1.1) : weeklyStats.maxCal;
                    const h = d.cal > 0 ? Math.max((d.cal / barMax) * 88, 4) : 2;
                    const overTdee = tdee && d.cal > tdee;
                    const noData = d.cal === 0;
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        {/* Cal label on hover area */}
                        <div style={{ fontSize: 9, color: noData ? "transparent" : "#5a7a5e", height: 12, transition: "color 0.2s" }}>
                          {d.cal > 0 ? d.cal : ""}
                        </div>
                        {/* Bar */}
                        <div style={{
                          width: "100%", maxWidth: 42, height: h, borderRadius: 4,
                          background: noData
                            ? "rgba(76,175,80,0.06)"
                            : overTdee
                              ? "linear-gradient(180deg, #FFA726, #E65100)"
                              : d.isToday
                                ? "linear-gradient(180deg, #66BB6A, #2e7d32)"
                                : "linear-gradient(180deg, rgba(76,175,80,0.45), rgba(76,175,80,0.2))",
                          transition: "height 0.5s ease",
                          position: "relative",
                        }}>
                          {/* TDEE line */}
                          {tdee && d.cal > 0 && (() => {
                            const tdeeH = (tdee / barMax) * 88;
                            if (tdeeH > h) return null;
                            return <div style={{
                              position: "absolute", bottom: tdeeH, left: -1, right: -1, height: 1,
                              background: "rgba(239,83,80,0.5)",
                            }} />;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Day labels */}
                <div style={{ display: "flex", gap: 4 }}>
                  {weeklyStats.days.map((d, i) => (
                    <div key={i} style={{
                      flex: 1, textAlign: "center",
                      fontSize: 10, fontWeight: d.isToday ? 600 : 400,
                      color: d.isToday ? "#66BB6A" : "#4a6a4e",
                    }}>
                      {d.dayName}
                    </div>
                  ))}
                </div>

                {/* TDEE comparison */}
                {tdee && weeklyStats.daysWithData >= 2 && (
                  <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(8,15,11,0.4)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#5a7a5e" }}>Gns. vs TDEE ({tdee})</span>
                      {(() => {
                        const diff = weeklyStats.avg - tdee;
                        const weeklyDiff = diff * 7;
                        const kgEstimate = (weeklyDiff / 7700).toFixed(2);
                        const isDeficit = diff < 0;
                        return (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: isDeficit ? "#66BB6A" : "#FFA726" }}>
                              {diff > 0 ? "+" : ""}{diff} kcal/dag
                            </div>
                            <div style={{ fontSize: 10, color: "#4a6a4e", marginTop: 1 }}>
                              ≈ {isDeficit ? "" : "+"}{kgEstimate} kg/uge
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <button onClick={() => setShowResetModal(true)} style={{ background: "none", border: "none", color: "#5a7a5e", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>Nulstil app</button>
              <button onClick={editProfile} style={{ background: "none", border: "none", color: "#4a7a50", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}>Rediger profil</button>
            </div>

            {/* Main tabs */}
            <div style={{ display: "flex", gap: 3, marginBottom: 14, background: "rgba(16,26,20,0.6)", borderRadius: 11, padding: 3 }}>
              {[{ id: "log", label: "Tilføj" }, { id: "today", label: "I dag" }, { id: "weight", label: "Vægt" }, { id: "history", label: "Historik" }].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  flex: 1, padding: "9px 14px", borderRadius: 9, border: "none",
                  background: tab === t.id ? "rgba(76,175,80,0.15)" : "transparent",
                  color: tab === t.id ? "#66BB6A" : "#6a8a6e",
                  fontSize: 12, fontWeight: tab === t.id ? 600 : 400,
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                }}>{t.label}</button>
              ))}
            </div>

            {tab === "log" && (
              <div className="an">
                {/* Food card */}
                <div style={{ ...cardStyle, padding: 18, marginBottom: 10 }}>
                  {/* Sub-tabs */}
                  <div style={{ display: "flex", gap: 0, marginBottom: 14, borderBottom: "1px solid rgba(76,175,80,0.08)" }}>
                    {[
                      { id: "search", label: "Søg", count: null },
                      { id: "favorites", label: "Favoritter", count: favorites.length || null },
                      { id: "recent", label: "Seneste", count: recentFoods.length || null },
                    ].map(ft => (
                      <button key={ft.id} className="ftab" onClick={() => setFoodTab(ft.id)} style={{
                        padding: "8px 14px", border: "none", cursor: "pointer", fontFamily: "inherit",
                        background: "transparent", fontSize: 12,
                        color: foodTab === ft.id ? "#66BB6A" : "#5a7a5e",
                        fontWeight: foodTab === ft.id ? 600 : 400,
                        borderBottom: foodTab === ft.id ? "2px solid #66BB6A" : "2px solid transparent",
                        marginBottom: -1,
                      }}>{ft.label}{ft.count ? ` (${ft.count})` : ""}</button>
                    ))}
                  </div>

                  {foodTab === "search" && (
                    <div style={{ position: "relative" }}>
                      <input type="text" placeholder="Søg f.eks. kylling, rugbrød, laks..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setShowDrop(true); setSelectedFood(null); }}
                        onFocus={() => setShowDrop(true)}
                        onBlur={() => setTimeout(() => setShowDrop(false), 200)}
                        style={{ ...inputStyle, fontSize: 14 }}
                      />
                      {showDrop && filtered.length > 0 && !selectedFood && (
                        <div style={{
                          position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
                          background: "rgba(14,24,18,0.98)", border: "1px solid rgba(76,175,80,0.15)",
                          borderRadius: 12, overflow: "hidden", zIndex: 20,
                          maxHeight: 380, overflowY: "auto", backdropFilter: "blur(16px)",
                        }}>
                          {filtered.map((food, i) => <FoodRow key={i} food={food} onSelect={selectFood} />)}
                        </div>
                      )}
                    </div>
                  )}

                  {foodTab === "favorites" && (
                    favFoods.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 10px", color: "#4a6a4e", fontSize: 12 }}>
                        <div style={{ marginBottom: 6 }}>Ingen favoritter endnu</div>
                        <div style={{ fontSize: 11, color: "#3a5a3e" }}>Tryk på ★ ved en fødevare for at tilføje den</div>
                      </div>
                    ) : (
                      <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 10, border: "1px solid rgba(76,175,80,0.06)" }}>
                        {favFoods.map((food, i) => <FoodRow key={i} food={food} onSelect={selectFood} />)}
                      </div>
                    )
                  )}

                  {foodTab === "recent" && (
                    recentFoods.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 10px", color: "#4a6a4e", fontSize: 12 }}>
                        <div>Ingen seneste fødevarer</div>
                        <div style={{ fontSize: 11, color: "#3a5a3e", marginTop: 4 }}>Tilføjede fødevarer vises her automatisk</div>
                      </div>
                    ) : (
                      <div style={{ maxHeight: 300, overflowY: "auto", borderRadius: 10, border: "1px solid rgba(76,175,80,0.06)" }}>
                        {recentFoods.map((food, i) => <FoodRow key={i} food={food} onSelect={selectFood} />)}
                      </div>
                    )
                  )}

                  {/* Selected food */}
                  {selectedFood && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(76,175,80,0.08)" }}>
                      <div style={{ fontSize: 13, color: "#b8ccbb", fontWeight: 500, marginBottom: 10 }}>{selectedFood.n}</div>

                      {/* Meal picker */}
                      {mealPicker}

                      <div style={{ display: "flex", gap: 10, alignItems: "end", marginTop: 10 }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", display: "block", marginBottom: 5 }}>Mængde (gram)</label>
                          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} style={inputStyle}
                            onFocus={e => e.target.style.borderColor = "rgba(76,175,80,0.45)"} onBlur={e => e.target.style.borderColor = "rgba(76,175,80,0.18)"} />
                        </div>
                        <div style={{ textAlign: "right", minWidth: 75, paddingBottom: 2 }}>
                          <div style={{ fontSize: 24, fontWeight: 400, color: "#66BB6A", fontFamily: "'Instrument Serif', serif" }}>
                            {amount ? Math.round((selectedFood.c / 100) * parseFloat(amount)) : 0}
                          </div>
                          <div style={{ fontSize: 10, color: "#5a7a5e" }}>kcal</div>
                        </div>
                      </div>
                      <button onClick={addEntry} style={{
                        width: "100%", marginTop: 12, padding: 12,
                        background: "linear-gradient(135deg, #2e7d32, #43A047)",
                        border: "none", borderRadius: 10, color: "#fff", fontSize: 13,
                        fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                      }}>+ Tilføj</button>
                    </div>
                  )}
                </div>

                {/* Info tip */}
                <div style={{
                  padding: "12px 14px", borderRadius: 10, marginBottom: 10,
                  background: "rgba(76,175,80,0.04)", border: "1px solid rgba(76,175,80,0.08)",
                  fontSize: 11, color: "#5a7a5e", lineHeight: 1.5,
                }}>
                  <span style={{ fontWeight: 600, color: "#6a8a6e" }}>Tip:</span> Kalorieværdier i databasen er for rå/uforarbejdet mad. Vej maden før tilberedning for mest præcist resultat.
                </div>

                {/* Custom food */}
                <div style={{ ...cardStyle, padding: 18, marginBottom: 18, borderColor: "rgba(76,175,80,0.06)" }}>
                  <div style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Tilføj egen fødevare</div>

                  {mealPicker}

                  <div style={{ marginTop: 8 }}>
                    <input type="text" placeholder="Navn på fødevare" value={customName} onChange={e => setCustomName(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: "10px 12px", marginBottom: 8 }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ fontSize: 10, color: "#5a7a5e", display: "block", marginBottom: 4 }}>Kalorier per 100g</label>
                        <input type="number" placeholder="f.eks. 250" value={customCal} onChange={e => setCustomCal(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: "10px 12px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "#5a7a5e", display: "block", marginBottom: 4 }}>Mængde i gram</label>
                        <input type="number" placeholder="f.eks. 150" value={customAmt} onChange={e => setCustomAmt(e.target.value)} style={{ ...inputStyle, fontSize: 13, padding: "10px 12px" }} />
                      </div>
                    </div>
                  </div>
                  {customName && customCal && customAmt && (
                    <div style={{ textAlign: "right", marginTop: 8, fontSize: 13, color: "#4a7a50", fontWeight: 500 }}>= {Math.round((parseFloat(customCal) / 100) * parseFloat(customAmt))} kcal</div>
                  )}
                  <button onClick={addCustom} style={{
                    width: "100%", marginTop: 10, padding: 11,
                    background: customName && customCal && customAmt ? "rgba(76,175,80,0.15)" : "rgba(76,175,80,0.05)",
                    border: "1px solid rgba(76,175,80,0.12)", borderRadius: 10,
                    color: customName && customCal && customAmt ? "#66BB6A" : "#4a6a4e",
                    fontSize: 12, fontWeight: 500, cursor: customName && customCal && customAmt ? "pointer" : "default", fontFamily: "inherit",
                  }}>+ Tilføj egen</button>
                </div>
              </div>
            )}

            {/* Today tab - grouped by meal */}
            {tab === "today" && (
              <div className="an">
                {todayEntries.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#4a6a4e", fontSize: 13 }}>Ingen registreringer i dag</div>
                ) : (
                  MEALS.map(m => {
                    const mData = mealBreakdown[m.id];
                    if (!mData || mData.entries.length === 0) return null;
                    const expanded = expandedMeals[m.id] !== false;
                    return (
                      <div key={m.id} style={{ marginBottom: 12 }}>
                        <button className="mhdr" onClick={() => toggleMealExpand(m.id)}
                          style={{
                            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                            background: "rgba(16,26,20,0.4)", border: "none",
                            fontFamily: "inherit",
                          }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 3, height: 24, borderRadius: 2, background: m.color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#b8ccbb" }}>{m.icon} {m.label}</span>
                            <span style={{ fontSize: 11, color: "#5a7a5e" }}>({mData.entries.length})</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: m.color }}>{mData.cal} kcal</span>
                            <span style={{ fontSize: 12, color: "#5a7a5e", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
                          </div>
                        </button>

                        {expanded && (
                          <div style={{ marginTop: 3 }}>
                            {mData.entries.map(entry => (
                              <div key={entry.id} className="er" style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "10px 14px 10px 28px", borderRadius: 8, marginBottom: 2,
                                background: "rgba(16,26,20,0.25)",
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, color: "#b8ccbb", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.food}</div>
                                  <div style={{ fontSize: 10, color: "#4a6a4e", marginTop: 1 }}>{entry.amount}g · {entry.time}</div>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: "#66BB6A", marginRight: 8, whiteSpace: "nowrap" }}>{entry.calories} kcal</div>
                                <button className="rb" onClick={() => removeEntry(entry.id)} style={{ background: "none", border: "none", color: "#EF5350", cursor: "pointer", fontSize: 15, padding: "3px 7px" }}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Weight tab */}
            {tab === "weight" && (
              <div className="an">
                {/* Weight input */}
                <div style={{ ...cardStyle, padding: 18, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>Registrer vægt</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "end" }}>
                    <div style={{ flex: 1 }}>
                      <input type="number" placeholder={savedProfile ? String(savedProfile.weight) : "75.0"} value={newWeight}
                        onChange={e => setNewWeight(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") addWeightLog(); }}
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = "rgba(76,175,80,0.45)"}
                        onBlur={e => e.target.style.borderColor = "rgba(76,175,80,0.18)"}
                      />
                    </div>
                    <span style={{ fontSize: 14, color: "#5a7a5e", paddingBottom: 12 }}>kg</span>
                    <button onClick={addWeightLog} style={{
                      padding: "11px 20px", background: "linear-gradient(135deg, #2e7d32, #43A047)",
                      border: "none", borderRadius: 10, color: "#fff", fontSize: 13,
                      fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                    }}>+ Log</button>
                  </div>
                  <div style={{ fontSize: 11, color: "#4a6a4e", marginTop: 6 }}>
                    {weightLogs.length > 0 && weightLogs.find(l => l.date === todayStr)
                      ? `I dag: ${weightLogs.find(l => l.date === todayStr).weight} kg`
                      : "Ingen vejning i dag"
                    }
                  </div>
                </div>

                {/* Graph */}
                {graphData.length >= 2 ? (() => {
                  const W = 500, H = 260, padL = 48, padR = 20, padT = 28, padB = 40;
                  const gW = W - padL - padR, gH = H - padT - padB;
                  const weights = graphData.map(d => d.weight);
                  const wMin = Math.min(...weights), wMax = Math.max(...weights);
                  const wRange = wMax - wMin || 1;
                  const wPad = wRange * 0.15;
                  const yMin = wMin - wPad, yMax = wMax + wPad;
                  const yRange = yMax - yMin;

                  const pts = graphData.map((d, i) => ({
                    x: padL + (graphData.length === 1 ? gW / 2 : (i / (graphData.length - 1)) * gW),
                    y: padT + gH - ((d.weight - yMin) / yRange) * gH,
                    ...d,
                  }));

                  // Smooth curve path
                  const linePath = pts.length < 2 ? "" : pts.reduce((path, p, i) => {
                    if (i === 0) return `M ${p.x} ${p.y}`;
                    const prev = pts[i - 1];
                    const cpx = (prev.x + p.x) / 2;
                    return `${path} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
                  }, "");

                  // Gradient area path
                  const areaPath = linePath + ` L ${pts[pts.length-1].x} ${padT + gH} L ${pts[0].x} ${padT + gH} Z`;

                  // Y axis ticks
                  const yTicks = 5;
                  const yTickVals = Array.from({ length: yTicks }, (_, i) => yMin + (i / (yTicks - 1)) * yRange);

                  // Stats
                  const first = graphData[0].weight, last = graphData[graphData.length - 1].weight;
                  const diff = last - first;
                  const diffColor = diff < 0 ? "#66BB6A" : diff > 0 ? "#FFA726" : "#5a7a5e";

                  return (
                    <div style={{ ...cardStyle, padding: "18px 14px", marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                        <div style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase" }}>Vægtudvikling</div>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <span style={{ fontSize: 22, fontWeight: 400, fontFamily: "'Instrument Serif', serif", color: "#e0e8e2" }}>{last.toFixed(1)}</span>
                          <span style={{ fontSize: 12, color: "#5a7a5e" }}>kg</span>
                          {graphData.length > 1 && (
                            <span style={{ fontSize: 12, fontWeight: 600, color: diffColor }}>
                              {diff > 0 ? "+" : ""}{diff.toFixed(1)} kg
                            </span>
                          )}
                        </div>
                      </div>

                      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
                        <defs>
                          <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#66BB6A" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#66BB6A" stopOpacity="0.02" />
                          </linearGradient>
                          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#43A047" />
                            <stop offset="100%" stopColor="#66BB6A" />
                          </linearGradient>
                          <filter id="glow">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                          </filter>
                        </defs>

                        {/* Grid lines */}
                        {yTickVals.map((v, i) => {
                          const y = padT + gH - ((v - yMin) / yRange) * gH;
                          return (
                            <g key={i}>
                              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="rgba(76,175,80,0.07)" strokeWidth="1" />
                              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#4a6a4e" fontSize="10" fontFamily="DM Sans, sans-serif">{v.toFixed(1)}</text>
                            </g>
                          );
                        })}

                        {/* Area fill */}
                        <path d={areaPath} fill="url(#weightGrad)" />

                        {/* Line */}
                        <path d={linePath} fill="none" stroke="url(#lineGrad)" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)" />

                        {/* Data points */}
                        {pts.map((p, i) => (
                          <g key={i}>
                            <circle cx={p.x} cy={p.y} r="5" fill="#0e1812" stroke="#66BB6A" strokeWidth="2" />
                            <circle cx={p.x} cy={p.y} r="2" fill="#66BB6A" />
                            {/* Date labels for first, last, and every ~5th */}
                            {(i === 0 || i === pts.length - 1 || (pts.length > 6 && i % Math.ceil(pts.length / 5) === 0)) && (
                              <text x={p.x} y={padT + gH + 18} textAnchor={i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}
                                fill="#4a6a4e" fontSize="9" fontFamily="DM Sans, sans-serif">
                                {p.date.split(".").slice(0, 2).join("/")}
                              </text>
                            )}
                            {/* Calorie dot if available */}
                            {p.cal && tdee && (
                              <circle cx={p.x} cy={p.y - 12} r="3"
                                fill={p.cal > tdee ? "#FFA726" : "#5BA4CF"} opacity="0.7" />
                            )}
                          </g>
                        ))}
                      </svg>

                      {/* Legend */}
                      {graphData.some(d => d.cal) && (
                        <div style={{ display: "flex", gap: 14, marginTop: 8, justifyContent: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#5BA4CF" }} />
                            <span style={{ fontSize: 10, color: "#5a7a5e" }}>Under TDEE</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FFA726" }} />
                            <span style={{ fontSize: 10, color: "#5a7a5e" }}>Over TDEE</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })() : graphData.length === 1 ? (
                  <div style={{ ...cardStyle, padding: 20, marginBottom: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 36, fontWeight: 400, fontFamily: "'Instrument Serif', serif", color: "#66BB6A" }}>{graphData[0].weight.toFixed(1)}</div>
                    <div style={{ fontSize: 12, color: "#5a7a5e", marginTop: 4 }}>kg — tilføj flere vejninger for at se din udvikling</div>
                  </div>
                ) : (
                  <div style={{ ...cardStyle, padding: "30px 20px", marginBottom: 14, textAlign: "center" }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>⚖</div>
                    <div style={{ fontSize: 13, color: "#6a8a6e", marginBottom: 4 }}>Ingen vejninger registreret</div>
                    <div style={{ fontSize: 11, color: "#4a6a4e" }}>Log din vægt regelmæssigt for at følge din udvikling</div>
                  </div>
                )}

                {/* Weight log entries */}
                {weightLogs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: "#6a8a6e", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
                      Vejninger ({weightLogs.length})
                    </div>
                    {[...weightLogs].sort((a, b) => b.ts - a.ts).map((log, i, arr) => {
                      const prev = i < arr.length - 1 ? arr[i + 1] : null;
                      const diff = prev ? log.weight - prev.weight : null;
                      const dayCal = dailyCalories[log.date] || null;
                      return (
                        <div key={log.ts} className="er" style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          padding: "11px 13px", borderRadius: 10, marginBottom: 3,
                          background: "rgba(16,26,20,0.35)",
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                              <span style={{ fontSize: 15, fontWeight: 600, color: "#b8ccbb", fontFamily: "'Instrument Serif', serif" }}>{log.weight.toFixed(1)} kg</span>
                              {diff !== null && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: diff < 0 ? "#66BB6A" : diff > 0 ? "#FFA726" : "#5a7a5e" }}>
                                  {diff > 0 ? "+" : ""}{diff.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: "#4a6a4e", marginTop: 2 }}>
                              {log.date === todayStr ? "I dag" : log.date}
                              {dayCal ? ` · ${dayCal} kcal` : ""}
                            </div>
                          </div>
                          <button className="rb" onClick={() => removeWeightLog(log.ts)}
                            style={{ background: "none", border: "none", color: "#EF5350", cursor: "pointer", fontSize: 15, padding: "3px 7px" }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* History tab */}
            {tab === "history" && (
              <div className="an">
                {allDays.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#4a6a4e", fontSize: 13 }}>Ingen registreringer endnu</div>
                ) : (
                  allDays.map(([date, dayEntries]) => {
                    const dayTotal = dayEntries.reduce((s, e) => s + e.calories, 0);
                    const isToday = date === todayStr;
                    const expanded = isToday || expandedHistDays[date];

                    // Group by meal
                    const dayMeals = {};
                    MEALS.forEach(m => { dayMeals[m.id] = []; });
                    dayEntries.forEach(e => {
                      const mid = e.meal || "snack";
                      if (!dayMeals[mid]) dayMeals[mid] = [];
                      dayMeals[mid].push(e);
                    });

                    return (
                      <div key={date} style={{ marginBottom: 14 }}>
                        <button className="mhdr" onClick={() => !isToday && toggleHistDay(date)}
                          style={{
                            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "10px 14px", borderRadius: 10,
                            background: "rgba(16,26,20,0.45)", border: "none",
                            cursor: isToday ? "default" : "pointer", fontFamily: "inherit",
                          }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#b8ccbb" }}>{isToday ? "I dag" : date}</span>
                            <span style={{ fontSize: 11, color: "#5a7a5e" }}>({dayEntries.length} poster)</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#66BB6A" }}>{dayTotal} kcal</span>
                            {!isToday && <span style={{ fontSize: 12, color: "#5a7a5e", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>}
                          </div>
                        </button>

                        {expanded && (
                          <div style={{ marginTop: 4 }}>
                            {/* Mini meal breakdown */}
                            <div style={{ display: "flex", gap: 8, padding: "4px 14px 8px", flexWrap: "wrap" }}>
                              {MEALS.map(m => {
                                const mc = dayMeals[m.id]?.reduce((s, e) => s + e.calories, 0) || 0;
                                if (mc === 0) return null;
                                return (
                                  <span key={m.id} style={{ fontSize: 10, color: m.color, background: `${m.color}12`, padding: "2px 8px", borderRadius: 10 }}>
                                    {m.label} {mc} kcal
                                  </span>
                                );
                              })}
                            </div>

                            {MEALS.map(m => {
                              if (!dayMeals[m.id] || dayMeals[m.id].length === 0) return null;
                              return dayMeals[m.id].map(entry => (
                                <div key={entry.id} className="er" style={{
                                  display: "flex", justifyContent: "space-between", alignItems: "center",
                                  padding: "8px 13px 8px 20px", borderRadius: 7, marginBottom: 2,
                                  background: "rgba(16,26,20,0.25)",
                                }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                                    <div style={{ width: 3, height: 14, borderRadius: 1, background: m.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, color: "#97b09b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.food}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 10, color: "#4a6a4e" }}>{entry.amount}g</span>
                                    <span style={{ fontSize: 10, color: "#4a6a4e" }}>{entry.time}</span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "#66BB6A" }}>{entry.calories}</span>
                                    <button className="rb" onClick={() => removeEntry(entry.id)} style={{ background: "none", border: "none", color: "#EF5350", cursor: "pointer", fontSize: 13, padding: "2px 5px" }}>×</button>
                                  </div>
                                </div>
                              ));
                            })}

                            {tdee && (
                              <div style={{ marginTop: 4, paddingLeft: 14, fontSize: 10, color: dayTotal > tdee ? "#FFA726" : "#4a6a4e" }}>
                                {dayTotal > tdee ? `+${dayTotal - tdee} kcal over TDEE` : `${tdee - dayTotal} kcal under TDEE`}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showResetModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
        }} onClick={() => setShowResetModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            ...cardStyle, padding: "28px 24px", maxWidth: 360, width: "100%",
            border: "1px solid rgba(76,175,80,0.2)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 400, fontFamily: "'Instrument Serif', serif", color: "#e0e8e2", marginBottom: 8 }}>Nulstil app</div>
            <div style={{ fontSize: 13, color: "#8aa88e", marginBottom: 22, lineHeight: 1.5 }}>Vil du beholde dine data til senere brug?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => resetApp(true)} style={{
                padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(76,175,80,0.25)",
                background: "rgba(76,175,80,0.1)", color: "#66BB6A", fontSize: 13,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>Ja, gem data og nulstil</button>
              <button onClick={() => resetApp(false)} style={{
                padding: "12px 16px", borderRadius: 10, border: "1px solid rgba(239,83,80,0.2)",
                background: "rgba(239,83,80,0.06)", color: "#EF5350", fontSize: 13,
                fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}>Nej, slet alt og nulstil</button>
              <button onClick={() => setShowResetModal(false)} style={{
                padding: "10px 16px", borderRadius: 10, border: "none",
                background: "transparent", color: "#5a7a5e", fontSize: 12,
                cursor: "pointer", fontFamily: "inherit",
              }}>Annuller</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
