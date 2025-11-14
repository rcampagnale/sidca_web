// src/redux/reducers/afiliadoActualizado/slice.js
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  endBefore,
  limitToLast,
  documentId,
  doc,
  updateDoc,
  deleteDoc,
  startAt,
  endAt,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";

// ==========================
// Config
// ==========================
const COLLECTION = "nuevoAfiliado";
const PAGE_SIZE = 20;
// Intentos de orden “bonitos”. Si no hay datos en estos campos, caemos a __name__.
const ORDER_FIELDS = ["createdAt", "fecha"];

// ==========================
// Cursores (fuera del estado Redux)
// ==========================
let _orderField = null;   // "createdAt" | "fecha" | "__name__"
let _lastDoc = null;      // último doc de la página actual (para Next)
let _firstDoc = null;     // primer doc de la página actual
let _pageFirsts = [];     // pila con el primer doc de cada página (para Prev)

// Helpers
const orderByConstraint = (field) =>
  field === "__name__" ? orderBy(documentId(), "desc") : orderBy(field, "desc");

// Elegimos un campo de orden que devuelva AL MENOS 1 doc; si no, usamos __name__
async function selectOrderField() {
  if (_orderField) return _orderField;

  for (const f of ORDER_FIELDS) {
    try {
      const testQ = query(collection(db, COLLECTION), orderBy(f, "desc"), limit(1));
      const testSnap = await getDocs(testQ);
      if (!testSnap.empty) {
        _orderField = f;
        return _orderField;
      }
      // si está vacío, probamos el siguiente campo
    } catch {
      // si falla por índice/campo, probamos el siguiente
    }
  }
  _orderField = "__name__"; // fallback robusto
  return _orderField;
}

// =======================
// Browse: primera / next / prev
// =======================
export const fetchAfiliadosFirstPage = createAsyncThunk(
  "afiliadoActualizado/fetchFirst",
  async (_, { rejectWithValue }) => {
    try {
      const of = await selectOrderField();
      const q = query(collection(db, COLLECTION), orderByConstraint(of), limit(PAGE_SIZE));
      const snap = await getDocs(q);

      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      _firstDoc = snap.docs[0] || null;
      _lastDoc = snap.docs[snap.docs.length - 1] || null;
      _pageFirsts = [];
      if (_firstDoc) _pageFirsts.push(_firstDoc);

      return {
        docs,
        hasNext: snap.size === PAGE_SIZE,
        page: 1,
        orderField: of,
      };
    } catch (e) {
      return rejectWithValue(e?.message || "Error al cargar la primera página.");
    }
  }
);

export const fetchAfiliadosNextPage = createAsyncThunk(
  "afiliadoActualizado/fetchNext",
  async (_, { getState, rejectWithValue }) => {
    try {
      if (!_lastDoc) return rejectWithValue("No hay más páginas.");
      const { afiliadoActualizado } = getState();
      const of = _orderField || (await selectOrderField());

      const q = query(
        collection(db, COLLECTION),
        orderByConstraint(of),
        startAfter(_lastDoc),
        limit(PAGE_SIZE)
      );

      const snap = await getDocs(q);
      if (snap.empty) return rejectWithValue("No hay más páginas.");

      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      _firstDoc = snap.docs[0] || null;
      _lastDoc = snap.docs[snap.docs.length - 1] || null;
      if (_firstDoc) _pageFirsts.push(_firstDoc);

      return {
        docs,
        hasNext: snap.size === PAGE_SIZE,
        page: afiliadoActualizado.page + 1,
      };
    } catch (e) {
      return rejectWithValue(e?.message || "Error al cargar la siguiente página.");
    }
  }
);

export const fetchAfiliadosPrevPage = createAsyncThunk(
  "afiliadoActualizado/fetchPrev",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { afiliadoActualizado } = getState();
      if (afiliadoActualizado.page <= 1 || _pageFirsts.length < 2) {
        return rejectWithValue("No hay página anterior.");
      }

      const of = _orderField || (await selectOrderField());
      const currentFirst = _pageFirsts[_pageFirsts.length - 1];

      const q = query(
        collection(db, COLLECTION),
        orderByConstraint(of),
        endBefore(currentFirst),
        limitToLast(PAGE_SIZE)
      );

      const snap = await getDocs(q);
      if (snap.empty) return rejectWithValue("No hay página anterior.");

      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // reemplazamos el tope por el "primer doc" de esta nueva página
      _pageFirsts.pop();
      _firstDoc = snap.docs[0] || null;
      _lastDoc = snap.docs[snap.docs.length - 1] || null;
      if (_firstDoc) _pageFirsts[_pageFirsts.length - 1] = _firstDoc;

      return {
        docs,
        hasNext: true, // el botón Next decide con _lastDoc en la siguiente
        page: afiliadoActualizado.page - 1,
      };
    } catch (e) {
      return rejectWithValue(e?.message || "Error al obtener la página anterior.");
    }
  }
);

// =======================
// Search por DNI (prefijo) con startAt / endAt
// =======================
export const searchAfiliadosByDniFirst = createAsyncThunk(
  "afiliadoActualizado/searchDniFirst",
  async ({ term }, { rejectWithValue }) => {
    try {
      const dni = (term || "").toString().trim();
      if (!dni) {
        return {
          items: [],
          term: "",
          firstVal: null,
          lastVal: null,
          hasNext: false,
        };
      }

      const q = query(
        collection(db, COLLECTION),
        orderBy("dni"),
        startAt(dni),
        endAt(dni + "\uf8ff"),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      return {
        items: rows,
        term: dni,
        firstVal: rows[0]?.dni ?? null,
        lastVal: rows.at(-1)?.dni ?? null,
        hasNext: rows.length === PAGE_SIZE,
      };
    } catch (e) {
      return rejectWithValue(e?.message || "Error al buscar por DNI.");
    }
  }
);

export const searchAfiliadosByDniNext = createAsyncThunk(
  "afiliadoActualizado/searchDniNext",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { afiliadoActualizado } = getState();
      const { search } = afiliadoActualizado;
      if (search.mode !== "dni" || !search.term) {
        return rejectWithValue("No hay búsqueda activa.");
      }

      const q = query(
        collection(db, COLLECTION),
        orderBy("dni"),
        startAfter(search.lastVal ?? search.term),
        endAt(search.term + "\uf8ff"),
        limit(PAGE_SIZE)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      return {
        items: rows,
        firstVal: rows[0]?.dni ?? null,
        lastVal: rows.at(-1)?.dni ?? null,
        hasNext: rows.length === PAGE_SIZE,
      };
    } catch (e) {
      return rejectWithValue(e?.message || "Error al paginar búsqueda por DNI.");
    }
  }
);

// Limpiar búsqueda → volver a modo browse
export const clearAfiliadosSearch = createAsyncThunk(
  "afiliadoActualizado/clearSearch",
  async () => ({})
);

// =======================
// CRUD
// =======================
export const updateAfiliadoById = createAsyncThunk(
  "afiliadoActualizado/updateById",
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const ref = doc(db, COLLECTION, String(id));
      await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
      return { id: String(id), changes: data };
    } catch (err) {
      return rejectWithValue(err?.message || "No se pudo actualizar");
    }
  }
);

export const deleteAfiliadoById = createAsyncThunk(
  "afiliadoActualizado/deleteById",
  async (id, { rejectWithValue }) => {
    try {
      await deleteDoc(doc(db, COLLECTION, String(id)));
      return id;
    } catch (err) {
      return rejectWithValue(err?.message || "No se pudo eliminar");
    }
  }
);

// =======================
// Slice
// =======================
const initialState = {
  list: [],
  processing: false,
  error: null,
  page: 1,
  hasNext: false,
  orderField: null,

  // búsqueda
  mode: "browse", // 'browse' | 'search'
  search: { mode: null, term: "", firstVal: null, lastVal: null, hasNext: false },
};

const slice = createSlice({
  name: "afiliadoActualizado",
  initialState,
  reducers: {
    reset(state) {
      Object.assign(state, initialState);
      _orderField = null;
      _lastDoc = null;
      _firstDoc = null;
      _pageFirsts = [];
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    // === Browse
    b.addCase(fetchAfiliadosFirstPage.pending, (s) => {
      s.processing = true;
      s.error = null;
      s.mode = "browse";
    })
      .addCase(fetchAfiliadosFirstPage.fulfilled, (s, a) => {
        s.processing = false;
        s.list = a.payload.docs;
        s.page = a.payload.page;
        s.hasNext = a.payload.hasNext;
        s.orderField = a.payload.orderField;
      })
      .addCase(fetchAfiliadosFirstPage.rejected, (s, a) => {
        s.processing = false;
        s.error = a.payload || a.error.message || "Error al cargar.";
      });

    b.addCase(fetchAfiliadosNextPage.pending, (s) => {
      s.processing = true;
      s.error = null;
    })
      .addCase(fetchAfiliadosNextPage.fulfilled, (s, a) => {
        s.processing = false;
        s.list = a.payload.docs;
        s.page = a.payload.page;
        s.hasNext = a.payload.hasNext;
      })
      .addCase(fetchAfiliadosNextPage.rejected, (s, a) => {
        s.processing = false;
        s.error = a.payload || a.error.message || "No hay más páginas.";
      });

    b.addCase(fetchAfiliadosPrevPage.pending, (s) => {
      s.processing = true;
      s.error = null;
    })
      .addCase(fetchAfiliadosPrevPage.fulfilled, (s, a) => {
        s.processing = false;
        s.list = a.payload.docs;
        s.page = a.payload.page;
        s.hasNext = a.payload.hasNext;
      })
      .addCase(fetchAfiliadosPrevPage.rejected, (s, a) => {
        s.processing = false;
        s.error = a.payload || a.error.message || "No hay página anterior.";
      });

    // === Search DNI
    b.addCase(searchAfiliadosByDniFirst.pending, (s) => {
      s.processing = true;
      s.error = null;
    })
      .addCase(searchAfiliadosByDniFirst.fulfilled, (s, a) => {
        s.processing = false;
        s.mode = "search";
        s.search = {
          mode: "dni",
          term: a.payload.term,
          firstVal: a.payload.firstVal,
          lastVal: a.payload.lastVal,
          hasNext: a.payload.hasNext,
        };
        s.list = a.payload.items;
        s.page = 1;
        s.hasNext = a.payload.hasNext;
      })
      .addCase(searchAfiliadosByDniFirst.rejected, (s, a) => {
        s.processing = false;
        s.error = a.payload || a.error?.message || "Error en la búsqueda";
      });

    b.addCase(searchAfiliadosByDniNext.pending, (s) => {
      s.processing = true;
      s.error = null;
    })
      .addCase(searchAfiliadosByDniNext.fulfilled, (s, a) => {
        s.processing = false;
        s.list = a.payload.items;
        s.page += a.payload.items.length ? 1 : 0;
        s.hasNext = a.payload.hasNext;
        s.search.firstVal = a.payload.firstVal;
        s.search.lastVal = a.payload.lastVal;
      })
      .addCase(searchAfiliadosByDniNext.rejected, (s, a) => {
        s.processing = false;
        s.error = a.payload || a.error?.message || "No hay más resultados";
      });

    b.addCase(clearAfiliadosSearch.fulfilled, (s) => {
      s.mode = "browse";
      s.search = { mode: null, term: "", firstVal: null, lastVal: null, hasNext: false };
    });

    // === CRUD
    b.addCase(updateAfiliadoById.pending, (s) => {
      s.error = null;
    })
      .addCase(updateAfiliadoById.fulfilled, (s, a) => {
        const { id, changes } = a.payload || {};
        const idx = s.list.findIndex((it) => it.id === id);
        if (idx !== -1) s.list[idx] = { ...s.list[idx], ...changes };
      })
      .addCase(updateAfiliadoById.rejected, (s, a) => {
        s.error = a.payload || "No se pudo actualizar el afiliado";
      });

    b.addCase(deleteAfiliadoById.fulfilled, (s, a) => {
      s.list = s.list.filter((x) => x.id !== a.payload);
    });
  },
});

export const { reset, clearError } = slice.actions;

// Selectores (store key: afiliadoActualizado)
export const selectAfiliadosList = (s) => s.afiliadoActualizado.list;
export const selectAfiliadosLoading = (s) => s.afiliadoActualizado.processing;
export const selectAfiliadosError = (s) => s.afiliadoActualizado.error;
export const selectAfiliadosPage = (s) => s.afiliadoActualizado.page;
export const selectAfiliadosHasNext = (s) => s.afiliadoActualizado.hasNext;
export const selectAfiliadosMode = (s) => s.afiliadoActualizado.mode;
export const selectAfiliadosSearch = (s) => s.afiliadoActualizado.search;

export default slice.reducer;


