// Local screenshot reviews only. With `VITE_DATA_SNAPSHOT=1` on the dev server, the pages read the
// same rows from JSON exported by scripts/export_snapshot.py instead of the Rayfin connector, so the
// UI can be checked without a Fabric sign-in. `import.meta.env.DEV` is false in every production
// build, so this path is compiled out of the deployed app.

export const SNAPSHOT = import.meta.env.DEV && import.meta.env.VITE_DATA_SNAPSHOT === "1";

/** `live()` in the app; the exported rows for `entity` on a snapshot dev server. */
export function pick<T>(entity: string, live: () => Promise<T>): Promise<T> {
    if (!SNAPSHOT) return live();
    return fetch(`/__snapshot/${entity}.json`).then((r) => {
        if (!r.ok) throw new Error(`Snapshot ${entity}.json not found (run scripts/export_snapshot.py)`);
        return r.json() as Promise<T>;
    });
}
