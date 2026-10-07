import {
  emptyMuseum,
  validateBackup,
  type MuseumBackup,
  type Draft,
  type Preferences,
} from './model';
const DB_NAME = 'museum-of-becoming';
let connection: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  if (!connection)
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('records');
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('请关闭同站点的其他标签页后重试。'));
    }).catch((e) => {
      connection = undefined;
      throw e;
    });
  return connection;
}
export async function getStored<T>(key: string): Promise<T | undefined> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('records', 'readonly');
    const req = tx.objectStore('records').get(key);
    let result: T | undefined;
    req.onsuccess = () => {
      result = req.result as T | undefined;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function writeStored(entries: Record<string, unknown>, remove: string[] = []) {
  const database = await db();
  return new Promise<void>((resolve, reject) => {
    const tx = database.transaction('records', 'readwrite');
    const store = tx.objectStore('records');
    try {
      Object.entries(entries).forEach(([key, value]) => store.put(value, key));
      remove.forEach((key) => store.delete(key));
    } catch (error) {
      // 结构化克隆等同步错误不会自动终止事务，必须主动回滚已排队的写入。
      tx.abort();
      reject(error);
      return;
    }
    // 只在事务提交后反馈成功，写入请求成功并不代表全部数据已落盘。
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('保存失败。'));
    tx.onabort = () => reject(tx.error || new Error('保存事务已取消。'));
  });
}
export async function loadMuseum() {
  const [museum, preferences] = await Promise.all([
    getStored<MuseumBackup>('museum'),
    getStored<Preferences>('preferences'),
  ]);
  return {
    museum: museum ? validateBackup(museum) : emptyMuseum(),
    preferences: preferences || ({ mode: 'demo', initialized: false } as Preferences),
  };
}
export async function persistMuseum(
  museum: MuseumBackup,
  preferences: Preferences,
  clearDraft = false,
) {
  const safe = validateBackup(museum);
  // 整体恢复和正式收藏必须原子提交；失败时不移除草稿，也不更换当前馆藏。
  await writeStored({ museum: safe, preferences }, clearDraft ? ['draft'] : []);
}
let draftQueue = Promise.resolve();
export function persistDraft(draft: Draft | undefined) {
  // 串行写入防止旧输入的延迟事务覆盖新草稿；失败不阻塞后续重试。
  const operation = draftQueue
    .catch(() => {})
    .then(() => writeStored(draft ? { draft } : {}, draft ? [] : ['draft']));
  draftQueue = operation;
  return operation;
}
export async function finishDraftWrites() {
  await draftQueue.catch(() => {});
}
