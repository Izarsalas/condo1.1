import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, writeBatch, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { storage } from './storage';

// Maps our LocalStorage key identifiers to their corresponding subcollection paths under /users/{userId}/...
const SYNC_MAP: Record<string, { colName: string; isSingleDoc?: boolean }> = {
  'condobill_condos': { colName: 'condos' },
  'condobill_units': { colName: 'units' },
  'condobill_transactions': { colName: 'transactions' },
  'condobill_categories': { colName: 'categories' },
  'condobill_concepts': { colName: 'concepts' },
  'condobill_tasks': { colName: 'tasks' },
  'condobill_maintenance': { colName: 'maintenance' },
  'condobill_repairs': { colName: 'repairs' },
  'condobill_staff': { colName: 'staff' },
  'condobill_suppliers': { colName: 'suppliers' },
  'condobill_products': { colName: 'products' },
  'condobill_sales': { colName: 'sales' },
  'condobill_clients': { colName: 'clients' },
  'condobill_quotes': { colName: 'quotes' },
  'condobill_users': { colName: 'appUsers' },
  'condobill_employees': { colName: 'employees' },
  'condobill_work_areas': { colName: 'workAreas' },
  'condobill_receipts': { colName: 'receipts' },
  'condobill_cortes': { colName: 'cortes' },
  'condobill_ticket_settings': { colName: 'ticketSettings', isSingleDoc: true }
};

export interface SyncStats {
  condos: number;
  units: number;
  transactions: number;
  products: number;
  sales: number;
  clients: number;
  quotes: number;
  receipts: number;
  cortes: number;
}

export function getLocalStats(): SyncStats {
  const localData = storage.exportAllData();
  return {
    condos: (localData['condobill_condos'] || []).length,
    units: (localData['condobill_units'] || []).length,
    transactions: (localData['condobill_transactions'] || []).length,
    products: (localData['condobill_products'] || []).length,
    sales: (localData['condobill_sales'] || []).length,
    clients: (localData['condobill_clients'] || []).length,
    quotes: (localData['condobill_quotes'] || []).length,
    receipts: (localData['condobill_receipts'] || []).length,
    cortes: (localData['condobill_cortes'] || []).length
  };
}

/**
 * Upload active local storage data arrays to Firestore under the authenticated user's private space.
 */
export async function uploadToCloud(userId: string): Promise<void> {
  const localData = storage.exportAllData();

  for (const [localStorageKey, syncMeta] of Object.entries(SYNC_MAP)) {
    const rawData = localData[localStorageKey];
    const path = `users/${userId}/${syncMeta.colName}`;

    try {
      // 1. Fetch existing documents from Firestore to delete them and write the new ones (mirror upload)
      const colRef = collection(db, 'users', userId, syncMeta.colName);
      const snapshot = await getDocs(colRef);
      
      // Delete existing
      let batch = writeBatch(db);
      let batchCount = 0;
      
      for (const snapDoc of snapshot.docs) {
        batch.delete(snapDoc.ref);
        batchCount++;
        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }
      if (batchCount > 0) {
        await batch.commit();
      }

      // 2. Upload present local data
      if (syncMeta.isSingleDoc) {
        if (rawData) {
          const docRef = doc(db, 'users', userId, syncMeta.colName, 'settings');
          await setDoc(docRef, rawData);
        }
      } else if (Array.isArray(rawData) && rawData.length > 0) {
        batch = writeBatch(db);
        batchCount = 0;

        for (const item of rawData) {
          if (!item || !item.id) continue;
          
          const docRef = doc(db, 'users', userId, syncMeta.colName, item.id);
          batch.set(docRef, item);
          batchCount++;

          if (batchCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }

        if (batchCount > 0) {
          await batch.commit();
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }
}

/**
 * Download documents from Firestore and replace the current LocalStorage database.
 */
export async function downloadFromCloud(userId: string): Promise<SyncStats> {
  const downloadedMap: Record<string, any> = {};

  for (const [localStorageKey, syncMeta] of Object.entries(SYNC_MAP)) {
    const path = `users/${userId}/${syncMeta.colName}`;
    try {
      if (syncMeta.isSingleDoc) {
        const colRef = collection(db, 'users', userId, syncMeta.colName);
        const snapshot = await getDocs(colRef);
        if (!snapshot.empty) {
          downloadedMap[localStorageKey] = snapshot.docs[0].data();
        }
      } else {
        const colRef = collection(db, 'users', userId, syncMeta.colName);
        const snapshot = await getDocs(colRef);
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        downloadedMap[localStorageKey] = list;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  // Import downloaded maps directly into storage
  storage.importAllData(downloadedMap);

  return {
    condos: (downloadedMap['condobill_condos'] || []).length,
    units: (downloadedMap['condobill_units'] || []).length,
    transactions: (downloadedMap['condobill_transactions'] || []).length,
    products: (downloadedMap['condobill_products'] || []).length,
    sales: (downloadedMap['condobill_sales'] || []).length,
    clients: (downloadedMap['condobill_clients'] || []).length,
    quotes: (downloadedMap['condobill_quotes'] || []).length,
    receipts: (downloadedMap['condobill_receipts'] || []).length,
    cortes: (downloadedMap['condobill_cortes'] || []).length
  };
}
