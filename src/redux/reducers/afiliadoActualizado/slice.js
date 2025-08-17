import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  collection, query, orderBy, limit, getDocs, startAfter, doc, deleteDoc
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";

const COLLECTION = "nuevoAfiliado";
const PAGE_SIZE = 20;
const ORDER_FIELDS = ["createdAt", "fecha"];

// cursores fuera del estado
let _orderField = null;
let _lastDoc = null;
let _pageStarts = [];

function baseQuery(ofield) {
  return query(collection(db, COLLECTION), orderBy(ofield, "desc"), limit(PAGE_SIZE));
}

export const fetchAfiliadosFirstPage = createAsyncThunk(
  "afiliadoActualizado/fetchFirst",
  async () => {
     const snap = await getDocs(collection(db, COLLECTION));
    let docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 🔹 Ordenar en cliente por "fecha" (formato "dd/mm/yyyy HH:MM:SS")
    const parseFecha = (s) => {
      if (typeof s !== "string") return 0;
      const [dmy, hms = "00:00:00"] = s.trim().split(" ");
      const [d, m, y] = (dmy || "").split("/").map((n) => parseInt(n, 10));
      const [hh, mm, ss] = (hms || "").split(":").map((n) => parseInt(n, 10) || 0);
      // Devuelve timestamp; si falta algo, cae a 0 para ir al final
      return isFinite(y) && isFinite(m) && isFinite(d)
        ? new Date(y, (m || 1) - 1, d || 1, hh, mm, ss).getTime()
        : 0;
    };
    docs.sort((a, b) => parseFecha(b.fecha) - parseFecha(a.fecha));

    // 🔹 Desactivar paginación por ahora (rearmamos luego con orderBy)
    _orderField = null;
    _lastDoc = null;
    _pageStarts = [];

    return {
      docs,
      hasNext: false,
      page: 1,
      orderField: null,
    };
  }
);


export const fetchAfiliadosNextPage = createAsyncThunk(
  "afiliadoActualizado/fetchNext",
  async (_, { getState, rejectWithValue }) => {
    if (!_orderField || !_lastDoc) return rejectWithValue("No hay página siguiente.");
    const q = query(
      collection(db, COLLECTION),
      orderBy(_orderField, "desc"),
      startAfter(_lastDoc),
      limit(PAGE_SIZE)
    );
    const snap = await getDocs(q);
    if (snap.docs.length) {
      _pageStarts.push(snap.docs[0]);
      _lastDoc = snap.docs[snap.docs.length - 1] || null;
    }
    const { afiliadoActualizado } = getState();
    return {
      docs: snap.docs.map(d => ({ id: d.id, ...d.data() })),
      hasNext: snap.docs.length === PAGE_SIZE,
      page: afiliadoActualizado.page + 1,
    };
  }
);

export const fetchAfiliadosPrevPage = createAsyncThunk(
  "afiliadoActualizado/fetchPrev",
  async (_, { getState, rejectWithValue }) => {
    const { afiliadoActualizado } = getState();
    if (!_orderField || afiliadoActualizado.page <= 1 || _pageStarts.length < 2) {
      return rejectWithValue("No hay página anterior.");
    }
    _pageStarts.pop();
    const prevStart = _pageStarts[_pageStarts.length - 1];
    const q = query(
      collection(db, COLLECTION),
      orderBy(_orderField, "desc"),
      startAfter(prevStart),
      limit(PAGE_SIZE)
    );
    const snap = await getDocs(q);
    _lastDoc = snap.docs[snap.docs.length - 1] || null;
    return {
      docs: snap.docs.map(d => ({ id: d.id, ...d.data() })),
      hasNext: snap.docs.length === PAGE_SIZE,
      page: afiliadoActualizado.page - 1,
    };
  }
);

export const deleteAfiliadoById = createAsyncThunk(
  "afiliadoActualizado/deleteById",
  async (id) => {
    await deleteDoc(doc(db, COLLECTION, id));
    return id;
  }
);

const initialState = {
  list: [],
  processing: false,
  error: null,
  page: 1,
  hasNext: false,
  orderField: null,
};

const slice = createSlice({
  name: "afiliadoActualizado",
  initialState,
  reducers: {
    reset(state) {
      Object.assign(state, initialState);
      _orderField = null; _lastDoc = null; _pageStarts = [];
    },
    clearError(state) { state.error = null; },
  },
  extraReducers: (b) => {
    b.addCase(fetchAfiliadosFirstPage.pending, (s) => { s.processing = true; s.error = null; })
     .addCase(fetchAfiliadosFirstPage.fulfilled, (s, a) => {
        s.processing = false;
        s.list = a.payload.docs;
        s.page = a.payload.page;
        s.hasNext = a.payload.hasNext;
        s.orderField = a.payload.orderField;
     })
     .addCase(fetchAfiliadosFirstPage.rejected, (s, a) => {
        s.processing = false; s.error = a.error.message || "Error al cargar.";
     })

     .addCase(fetchAfiliadosNextPage.pending, (s) => { s.processing = true; s.error = null; })
     .addCase(fetchAfiliadosNextPage.fulfilled, (s, a) => {
        s.processing = false;
        s.list = a.payload.docs;
        s.page = a.payload.page;
        s.hasNext = a.payload.hasNext;
     })
     .addCase(fetchAfiliadosNextPage.rejected, (s, a) => {
        s.processing = false; s.error = a.payload || a.error.message || "No hay más páginas.";
     })

     .addCase(fetchAfiliadosPrevPage.pending, (s) => { s.processing = true; s.error = null; })
     .addCase(fetchAfiliadosPrevPage.fulfilled, (s, a) => {
        s.processing = false;
        s.list = a.payload.docs;
        s.page = a.payload.page;
        s.hasNext = a.payload.hasNext;
     })
     .addCase(fetchAfiliadosPrevPage.rejected, (s, a) => {
        s.processing = false; s.error = a.payload || a.error.message || "No hay página anterior.";
     })

     .addCase(deleteAfiliadoById.fulfilled, (s, a) => {
        s.list = s.list.filter(x => x.id !== a.payload);
     });
  }
});

export const { reset, clearError } = slice.actions;
export default slice.reducer;

export const selectAfiliadosList = (s) => s.afiliadoActualizado.list;
export const selectAfiliadosLoading = (s) => s.afiliadoActualizado.processing;
export const selectAfiliadosError = (s) => s.afiliadoActualizado.error;
export const selectAfiliadosPage = (s) => s.afiliadoActualizado.page;
export const selectAfiliadosHasNext = (s) => s.afiliadoActualizado.hasNext;

