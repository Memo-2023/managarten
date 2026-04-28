/**
 * Per-Space-Seeds barrel — side-effect imports register every module's
 * seeder into the per-space-seeds registry at module-load time.
 *
 * Boot order matters: this file must be imported BEFORE the first
 * `loadActiveSpace` call, otherwise `setActiveSpace` will fire
 * `runSpaceSeeds` against an empty registry and the user's Space
 * starts blank.
 *
 * The +layout.svelte boot path imports this barrel near the top of its
 * import block so registration completes before any reactive effect
 * has a chance to drive the Space lifecycle.
 *
 * See docs/plans/workbench-seeding-cleanup.md.
 */

// Side-effect: registers `workbench-home` in the per-space-seeds map.
import './workbench-home';

// Side-effect: registers `lasts-welcome` per-space-seed.
import './lasts';

// Side-effect: registers `forms-welcome` per-space-seed.
import './forms';
