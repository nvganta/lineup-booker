import type { QlooEntity } from "@/lib/qloo/types";
import type { PopularityBand } from "./tiers";

export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/** Collapse short vs long artist name variants for deduping. */
export function artistNameKey(name: string): string {
  const parts = normalizeArtistName(name).split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.slice(-2).join("");
  }
  return parts.join("");
}

export function isSamePerson(a: QlooEntity, b: QlooEntity): boolean {
  const idA = a.entity_id ?? a.id;
  const idB = b.entity_id ?? b.id;
  if (idA && idB && idA === idB) return true;

  const keyA = artistNameKey(a.name);
  const keyB = artistNameKey(b.name);
  if (keyA && keyB && keyA === keyB) return true;

  const na = normalizeArtistName(a.name);
  const nb = normalizeArtistName(b.name);
  if (na.length >= 3 && nb.includes(na)) return true;
  if (nb.length >= 3 && na.includes(nb)) return true;
  return false;
}

function entityTagIds(entity: QlooEntity): string[] {
  return (entity.tags ?? [])
    .map((t) => (t.id ?? "").toLowerCase())
    .filter(Boolean);
}

function musicGenreTagIds(tagIds: string[]): string[] {
  return tagIds.filter(
    (id) =>
      id.includes("genre:music") || id.includes("urn:tag:genre:media:music"),
  );
}

const NON_MUSIC_CAREER_TAG =
  /(?:^|:)(model|actress|actor|television|\btv\b|burlesque|reality|housewife|housewives|fashion|pageant|influencer|socialite|drag)(?:$|:|_)/;

function dominantNonMusicCareerTags(tagIds: string[]): string[] {
  return tagIds.filter((id) => {
    if (id.includes("genre:music") || id.includes("urn:tag:genre:media:music")) {
      return false;
    }
    return NON_MUSIC_CAREER_TAG.test(id);
  });
}

export function musicGenreTagShare(entity: QlooEntity): number {
  const ids = entityTagIds(entity);
  if (ids.length === 0) return 0;
  return musicGenreTagIds(ids).length / ids.length;
}

export function hasMusicCareerEvidence(entity: QlooEntity): boolean {
  const props = entity.properties;
  if (!props) return false;
  if (props.discography != null) return true;
  if (Array.isArray(props.albums) && props.albums.length > 0) return true;
  if (typeof props.album_count === "number" && props.album_count > 0) {
    return true;
  }
  return false;
}

const ACTOR_PROFILE_TAG =
  /(?:^|:)(actress|actor|film_actor|television_actor|voice_actor)(?:$|:|_)/;

function actorProfileTags(tagIds: string[]): string[] {
  return tagIds.filter((id) => ACTOR_PROFILE_TAG.test(id));
}

function isDominatedByNonMusicCareer(
  musicTags: string[],
  careerTags: string[],
): boolean {
  if (careerTags.length === 0) return false;
  if (careerTags.length > musicTags.length) return true;
  return musicTags.length === 1 && careerTags.length >= 2;
}

/** Qloo rows that read as “actor first” despite a stray music tag. */
export function isPrimarilyActorProfile(entity: QlooEntity): boolean {
  const ids = entityTagIds(entity);
  const actors = actorProfileTags(ids);
  if (actors.length === 0) return false;
  const musicTags = musicGenreTagIds(ids);
  if (musicTags.length === 0) return true;
  if (hasMusicCareerEvidence(entity)) {
    return actors.length > musicTags.length;
  }
  return actors.length >= musicTags.length;
}

function passesMusicCareerGate(entity: QlooEntity): boolean {
  const ids = entityTagIds(entity);
  const musicTags = musicGenreTagIds(ids);
  if (musicTags.length === 0) return false;

  if (isPrimarilyActorProfile(entity)) return false;

  const careerTags = dominantNonMusicCareerTags(ids);
  if (isDominatedByNonMusicCareer(musicTags, careerTags)) return false;

  if (hasMusicCareerEvidence(entity)) return true;

  return musicTags.length >= 1;
}

export function hasAnyMusicGenreTag(entity: QlooEntity): boolean {
  return entityTagIds(entity).some(
    (id) =>
      id.includes("genre:music") || id.includes("urn:tag:genre:media:music"),
  );
}

const BLOCKLIST_NAME_PATTERNS =
  /^(drag|burlesque|comedy|reality|housewives|bravo)/i;

const AGGRESSIVE_GENRE =
  /genre:music:(metal|heavy_metal|thrash|death_metal|black_metal|power_metal|glam_metal|speed_metal|hard_rock|arena_rock)/;

const QLOO_OBSCURITY_TAG = /urn:tag:obscurity:qloo:(\d+)/;

/** Lower values mean wider mainstream recognition in Qloo's obscurity scale. */
export function qlooObscurityLevel(entity: QlooEntity): number | null {
  for (const id of entityTagIds(entity)) {
    const match = id.match(QLOO_OBSCURITY_TAG);
    if (match) return Number(match[1]);
  }
  const scale = entity.properties?.obscurity_scale;
  if (typeof scale === "number" && Number.isFinite(scale)) return scale;
  return null;
}

/** Openers in rooms ≤300 seats must stay within the room band popularity cap. */
export function isOpenerTooFamousForSmallRoom(
  entity: QlooEntity,
  band: PopularityBand | undefined,
): boolean {
  if (!band?.seatCapacity || band.seatCapacity > 300) return false;
  if ((entity.popularity ?? 0) > band.openerMax) return true;
  return isTooFamousForSmallRoom(entity, band);
}

function isTooFamousForSmallRoom(
  entity: QlooEntity,
  band?: PopularityBand,
  relaxObscurityOneStep = false,
): boolean {
  const seatCap = band?.seatCapacity;
  if (seatCap === undefined || seatCap > 300) return false;
  const obscurity = qlooObscurityLevel(entity);
  if (obscurity === null) return false;
  const floor = relaxObscurityOneStep ? 1 : 2;
  return obscurity <= floor;
}

function requestWantsAggressive(genreTagIds: string[]): boolean {
  return genreTagIds.some((id) => AGGRESSIVE_GENRE.test(id));
}

/** Reject only when genre tags clearly fight the room (e.g. metal for indie/folk). */
export function hasGenreConflictForRoom(
  entity: QlooEntity,
  genreTagIds: string[],
): boolean {
  const musicTags = musicGenreTagIds(entityTagIds(entity));
  if (musicTags.length === 0) return false;
  if (requestWantsAggressive(genreTagIds)) return false;

  const aggressiveTags = musicTags.filter((id) => AGGRESSIVE_GENRE.test(id));
  if (aggressiveTags.length === 0) return false;

  return aggressiveTags.length >= Math.ceil(musicTags.length / 2);
}

export function isPersonOnlyEntity(entity: QlooEntity): boolean {
  const subtype = (entity.subtype ?? "").toLowerCase();
  const type = (entity.type ?? "").toLowerCase();
  const isPerson = subtype.includes("person") || type.includes("person");
  const isArtist =
    subtype.includes("urn:entity:artist") || type.includes("artist");
  return isPerson && !isArtist;
}

export function isArtistEntity(entity: QlooEntity): boolean {
  const subtype = (entity.subtype ?? "").toLowerCase();
  const type = (entity.type ?? "").toLowerCase();

  if (BLOCKLIST_NAME_PATTERNS.test(entity.name)) return false;
  if (isPersonOnlyEntity(entity)) return false;
  if (subtype.includes("brand") || subtype.includes("place")) return false;

  return subtype.includes("urn:entity:artist") || type.includes("artist");
}

export function isMusicArtist(
  entity: QlooEntity,
  genreTagIds: string[] = [],
): boolean {
  if (!isArtistEntity(entity)) return false;
  if (!hasAnyMusicGenreTag(entity)) return false;
  if (!passesMusicCareerGate(entity)) return false;
  if (genreTagIds.length > 0 && hasGenreConflictForRoom(entity, genreTagIds)) {
    return false;
  }
  return true;
}

function tagTokens(tagId: string): string[] {
  const tail = tagId.split(":").pop() ?? tagId;
  return tail.split(/[_\s-]+/).filter((t) => t.length >= 3);
}

export function genreOverlapCount(
  entity: QlooEntity,
  genreTagIds: string[],
): number {
  const ids = entityTagIds(entity);
  const exact = new Set(genreTagIds.map((g) => g.toLowerCase()));
  return ids.filter((id) => exact.has(id)).length;
}

export function genreTokenOverlapCount(
  entity: QlooEntity,
  genreTagIds: string[],
): number {
  const requestTokens = new Set(
    genreTagIds.flatMap((id) => tagTokens(id.toLowerCase())),
  );
  const entityTokens = entityTagIds(entity).flatMap((id) => tagTokens(id));
  let matches = 0;
  for (const token of entityTokens) {
    if (requestTokens.has(token)) matches += 1;
  }
  return matches;
}

export function meaningfulGenreOverlap(
  entity: QlooEntity,
  genreTagIds: string[],
): boolean {
  if (genreTagIds.length === 0) return true;
  if (genreOverlapCount(entity, genreTagIds) >= 1) return true;
  const tokenMatches = genreTokenOverlapCount(entity, genreTagIds);
  if (genreTagIds.length <= 2) return tokenMatches >= 1;
  return tokenMatches >= 2;
}

export function headlinerGenreScore(
  entity: QlooEntity,
  genreTagIds: string[],
): number {
  return (
    genreOverlapCount(entity, genreTagIds) * 10 +
    genreTokenOverlapCount(entity, genreTagIds)
  );
}

function musicArtistPreference(entity: QlooEntity): number {
  const subtype = (entity.subtype ?? "").toLowerCase();
  if (subtype.includes("urn:entity:artist") && !subtype.includes("person")) {
    return 2;
  }
  if (subtype.includes("artist")) return 1;
  return 0;
}

export function isLikelyArenaActForSmallRoom(
  entity: QlooEntity,
  band: PopularityBand | undefined,
  genreTagIds: string[],
): boolean {
  if (!band?.headlinerMax || band.headlinerMax > 0.88) return false;
  if (isTooFamousForSmallRoom(entity, band)) return true;
  const pop = entity.popularity ?? 0;
  if (pop > band.headlinerMax) return true;
  if (pop < 0.9) return false;
  return !meaningfulGenreOverlap(entity, genreTagIds);
}

function eligibleAsAlternate(
  entity: QlooEntity,
  band: PopularityBand | undefined,
  headliner: QlooEntity,
  relaxObscurityOneStep = false,
): boolean {
  if (!band) return true;

  if (isTooFamousForSmallRoom(entity, band, relaxObscurityOneStep)) {
    return false;
  }

  const pop = entity.popularity ?? 0;
  const headlinerPop = headliner.popularity ?? 0;
  const seatCap = band.seatCapacity;
  if (seatCap !== undefined && seatCap <= 200) {
    // A bench act may sit anywhere in the room's band. Capping it just above
    // the headliner emptied the bench whenever the pick was the least known
    // act in the band (Toronto, 60 seats: headliner 0.57, band to 0.88).
    const ceiling = Math.max(headlinerPop + 0.05, band.headlinerMax ?? 0);
    if (pop > ceiling) return false;
  }

  return true;
}

function eligibleForVenueHeadlinerBand(
  entity: QlooEntity,
  band?: PopularityBand,
): boolean {
  if (!band?.headlinerMax) return true;
  return (entity.popularity ?? 0) <= band.headlinerMax;
}

export function filterMusicArtists(
  entities: QlooEntity[],
  genreTagIds: string[],
  exclude: QlooEntity[] = [],
): QlooEntity[] {
  const seenKeys = new Set<string>();
  const out: QlooEntity[] = [];
  for (const entity of entities) {
    if (exclude.some((e) => isSamePerson(e, entity))) continue;
    if (!isMusicArtist(entity, genreTagIds)) continue;
    const key = artistNameKey(entity.name);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    out.push(entity);
  }
  return out;
}

function withinPopularityBand(
  entity: QlooEntity,
  band?: PopularityBand,
): boolean {
  if (!band) return true;
  const pop = entity.popularity ?? 0;
  if (band.headlinerMin !== undefined && pop < band.headlinerMin) return false;
  if (band.headlinerMax !== undefined && pop > band.headlinerMax) return false;
  return true;
}

export function rankHeadlinerPool(
  entities: QlooEntity[],
  genreTagIds: string[],
  band?: PopularityBand,
  exclude: QlooEntity[] = [],
): QlooEntity[] {
  const pool = filterMusicArtists(entities, genreTagIds, exclude).filter(
    (entity) =>
      meaningfulGenreOverlap(entity, genreTagIds) &&
      !isLikelyArenaActForSmallRoom(entity, band, genreTagIds) &&
      !isTooFamousForSmallRoom(entity, band),
  );

  return [...pool].sort((a, b) => {
    const scoreDiff =
      headlinerGenreScore(b, genreTagIds) -
      headlinerGenreScore(a, genreTagIds);
    if (scoreDiff !== 0) return scoreDiff;
    const pref = musicArtistPreference(b) - musicArtistPreference(a);
    if (pref !== 0) return pref;
    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });
}

export function rankHeadlinerCandidates(
  entities: QlooEntity[],
  genreTagIds: string[],
  band?: PopularityBand,
  exclude: QlooEntity[] = [],
): QlooEntity[] {
  return rankHeadlinerPool(entities, genreTagIds, band, exclude).filter((e) =>
    eligibleForVenueHeadlinerBand(e, band),
  );
}

export function rankAlternateHeadliners(
  entities: QlooEntity[],
  genreTagIds: string[],
  band: PopularityBand | undefined,
  headliner: QlooEntity,
  exclude: QlooEntity[] = [],
  options?: {
    relaxObscurityForTinyRoom?: boolean;
    /** Tiny rooms: allow alternates outside the headliner pop cap. */
    relaxBandCapForBench?: boolean;
  },
): QlooEntity[] {
  const relax = Boolean(
    options?.relaxObscurityForTinyRoom &&
      band?.seatCapacity !== undefined &&
      band.seatCapacity <= 120,
  );
  const pool = options?.relaxBandCapForBench
    ? rankHeadlinerPool(entities, genreTagIds, band, exclude)
    : rankHeadlinerCandidates(entities, genreTagIds, band, exclude);
  return pool.filter((entity) =>
    eligibleAsAlternate(entity, band, headliner, relax),
  );
}

export function headlinerPickOrder(
  entities: QlooEntity[],
  genreTagIds: string[],
  band?: PopularityBand,
  exclude: QlooEntity[] = [],
): QlooEntity[] {
  const ranked = rankHeadlinerPool(entities, genreTagIds, band, exclude);
  if (ranked.length === 0) return [];

  const inBand = band
    ? ranked.filter((e) => withinPopularityBand(e, band))
    : ranked;
  if (inBand.length > 0) return inBand;

  if (band?.headlinerMax !== undefined) {
    const underMax = ranked.filter(
      (e) => (e.popularity ?? 1) <= band.headlinerMax!,
    );
    if (underMax.length > 0) return underMax;
  }

  return ranked;
}

export function pickHeadliner(
  entities: QlooEntity[],
  genreTagIds: string[],
  band?: PopularityBand,
  exclude: QlooEntity[] = [],
): QlooEntity | undefined {
  return headlinerPickOrder(entities, genreTagIds, band, exclude)[0];
}

/** @deprecated use pickHeadliner */
export function pickFirstMusicArtist(
  entities: QlooEntity[],
  genreTagIds: string[],
  exclude: QlooEntity[] = [],
): QlooEntity | undefined {
  return pickHeadliner(entities, genreTagIds, undefined, exclude);
}
