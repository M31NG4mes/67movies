"""Server-side wrapper around kristal374/hdrezka-api for 67movies."""

from __future__ import annotations

import os
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit, urlunsplit

import requests
from HDrezka import (
    AJAXFail,
    EmptyPage,
    Filters,
    HDRezkaError,
    HDrezka,
    NetworkClient,
    PageNotFound,
    ServiceUnavailable,
)
from HDrezka.player.entities import Film, Serial

DEFAULT_MIRRORS = [
    m.strip()
    for m in (
        os.environ.get("HDREZKA_MIRROR", ""),
        "https://rezka.ag",
        "https://hdrezka.ag",
        "https://hdrezka.me",
        "https://hdrezka.cm",
    )
    if m.strip()
]

_CACHE: Dict[str, Tuple[float, Any]] = {}
_URL_BY_ID: Dict[str, str] = {}
SEARCH_TTL = 600
DETAILS_TTL = 900
STREAM_TTL = 300

QUALITY_MAP = {
    "360p": "360p",
    "480p": "480p",
    "720p": "720p",
    "1080p": "1080p",
    "1080p Ultra": "1080p",
    "2K": "1440p",
    "4K": "4K",
}

QUALITY_ORDER = {
    "4K": 7,
    "2160p": 7,
    "1440p": 6,
    "2K": 6,
    "1080p Ultra": 5,
    "1080p": 4,
    "720p": 3,
    "480p": 2,
    "360p": 1,
}


class HdRezkaServiceError(Exception):
    def __init__(self, code: str, message: str, status: int = 500):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


def _cache_get(key: str) -> Optional[Any]:
    entry = _CACHE.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.time() > expires_at:
        _CACHE.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any, ttl: int) -> Any:
    if len(_CACHE) > 250:
        now = time.time()
        expired = [k for k, (exp, _) in _CACHE.items() if exp <= now]
        for k in expired:
            _CACHE.pop(k, None)
    _CACHE[key] = (time.time() + ttl, value)
    return value


def _rewrite_url_domain(url: str, mirror: str) -> str:
    parsed = urlsplit(url)
    mirror_parsed = urlsplit(mirror)
    if not parsed.netloc:
        return f"{mirror.rstrip('/')}/{url.lstrip('/')}"
    return urlunsplit((mirror_parsed.scheme or "https", mirror_parsed.netloc, parsed.path, parsed.query, parsed.fragment))


def _normalize_image_url(url: Optional[str], mirror: str = "https://rezka.ag") -> Optional[str]:
    if not url:
        return None
    raw = str(url).strip()
    if not raw:
        return None
    if raw.startswith("//"):
        return f"https:{raw}"
    if raw.startswith("/"):
        return f"{mirror.rstrip('/')}{raw}"
    return raw


def _with_mirrors(fn):
    last_err: Optional[Exception] = None
    for mirror in DEFAULT_MIRRORS:
        try:
            client = HDrezka(mirror=mirror)
            return fn(client, mirror), mirror
        except (EmptyPage, PageNotFound) as err:
            raise err
        except (ServiceUnavailable, requests.RequestException, ConnectionError, TimeoutError) as err:
            last_err = err
            continue
        except HDRezkaError as err:
            last_err = err
            continue
    if last_err:
        raise HdRezkaServiceError(
            "CONNECTION_ERROR",
            f"Не удалось подключиться к HDRezka: {last_err}",
            status=503,
        )
    raise HdRezkaServiceError("CONNECTION_ERROR", "Нет доступных зеркал HDRezka", status=503)


def _extract_year(raw: Optional[str]) -> int:
    if not raw:
        return 0
    match = re.search(r"(19\d{2}|20\d{2})", str(raw))
    return int(match.group(1)) if match else 0


def _infer_media_type(entity: Optional[str], status: Optional[str] = None, url: Optional[str] = None) -> str:
    text = f"{entity or ''} {status or ''} {url or ''}".lower()
    if any(token in text for token in ("сериал", "series", "/series/", "мультсериал", "сезон", "серия")):
        return "tv"
    if "/animation/" in text and ("сезон" in text or "серия" in text):
        return "tv"
    return "movie"


def _normalize_poster(poster: Any, mirror: str = "https://rezka.ag") -> Dict[str, Any]:
    media_type = _infer_media_type(poster.entity, poster.status, poster.url)
    year = _extract_year(poster.year)
    genres = [g.strip() for g in str(poster.genre or "").split(",") if g.strip()]
    rid = f"rezka-{poster.id}"
    if getattr(poster, "url", None):
        _URL_BY_ID[rid] = poster.url
    return {
        "id": rid,
        "rezkaId": poster.id,
        "rezkaUrl": poster.url,
        "title": poster.title,
        "type": media_type,
        "entity": poster.entity,
        "posterUrl": _normalize_image_url(poster.img_url, mirror),
        "releaseYear": year,
        "country": poster.country,
        "genres": genres,
        "rating": float(poster.rates) if poster.rates is not None else 0.0,
        "status": poster.status,
        "source": "hdrezka",
    }


def get_catalog(category: str = "trending", page: int = 1, genre: Optional[str] = None) -> Dict[str, Any]:
    cat = (category or "trending").lower().strip()
    cache_key = f"catalog:{cat}:{genre or ''}:{page}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    def _fetch(client: HDrezka, _mirror: str):
        if cat == "popular_movies":
            nav = client.films().filter(Filters.POPULAR)
        elif cat == "popular_tv":
            nav = client.series().filter(Filters.POPULAR)
        elif cat == "new_movies":
            nav = client.films().filter(Filters.LAST)
        elif cat == "new_tv":
            nav = client.series().filter(Filters.LAST)
        elif cat == "watching":
            nav = client.filter(Filters.WATCHING)
        elif cat == "cartoons":
            nav = client.cartoons().filter(Filters.POPULAR)
        elif cat == "animation":
            nav = client.animation().filter(Filters.POPULAR)
        else:
            nav = client.filter(Filters.POPULAR)
        return nav.page(page).get()

    try:
        posters, mirror = _with_mirrors(_fetch)
    except EmptyPage:
        return _cache_set(cache_key, {"items": [], "page": page, "totalPages": page, "totalItems": 0}, SEARCH_TTL)

    items = [_normalize_poster(p, mirror) for p in posters]
    result = {
        "items": items,
        "page": page,
        "totalPages": page + 1 if len(items) >= 20 else page,
        "totalItems": len(items),
        "mirror": mirror,
    }
    return _cache_set(cache_key, result, SEARCH_TTL)


def search_content(query: str, page: int = 1) -> Dict[str, Any]:
    clean_query = (query or "").strip()
    if not clean_query:
        return {"items": [], "page": 1, "totalPages": 1, "totalItems": 0}

    cache_key = f"search:{clean_query.lower()}:{page}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    try:
        posters, mirror = _with_mirrors(lambda client, _: client.search(clean_query).page(page).get())
    except EmptyPage:
        return _cache_set(cache_key, {"items": [], "page": page, "totalPages": page, "totalItems": 0}, SEARCH_TTL)

    items = [_normalize_poster(p, mirror) for p in posters]
    result = {
        "items": items,
        "page": page,
        "totalPages": page + 1 if len(items) >= 30 else page,
        "totalItems": len(items),
        "mirror": mirror,
    }
    return _cache_set(cache_key, result, SEARCH_TTL)


def _extract_details_payload(details: Any) -> Dict[str, Any]:
    info = details.info_table
    release_year = _extract_year(str(info.release) if info and info.release else "")
    genres = [str(g) for g in (info.genre or [])] if info else []
    countries = [str(c) for c in (info.country or [])] if info else []

    rating_val = 0.0
    votes_val = 0
    if info and info.rates:
        for rate in info.rates:
            if rate and rate.rates:
                rating_val = float(rate.rates)
                votes_val = int(rate.votes or 0)
                if "кинопоиск" in (rate.name or "").lower() or "imdb" in (rate.name or "").lower():
                    break

    player = details.player
    is_serial = isinstance(player, Serial)
    media_type = "tv" if is_serial else "movie"

    translators: List[Dict[str, Any]] = []
    if player and getattr(player, "translate_list", None):
        for tr in player.translate_list:
            translators.append(
                {
                    "id": tr.id,
                    "title": tr.title,
                    "originalTitle": tr.original_title,
                    "fullTitle": tr.full_title,
                    "premium": bool(tr.premium),
                    "isDirector": bool(tr.is_director),
                    "isCamrip": bool(tr.is_camrip),
                    "isAds": bool(tr.is_abs),
                }
            )

    seasons: List[Dict[str, Any]] = []
    if is_serial and getattr(player, "seasons_tabs", None):
        for s in player.seasons_tabs:
            eps = [
                {
                    "id": f"rezka-ep-{details.id}-{s.id}-{ep.id}",
                    "episodeNumber": ep.id,
                    "seasonNumber": s.id,
                    "title": ep.title,
                }
                for ep in (s.episodes or [])
            ]
            seasons.append(
                {
                    "id": f"rezka-s-{details.id}-{s.id}",
                    "seasonNumber": s.id,
                    "title": s.title,
                    "episodeCount": len(eps),
                    "episodes": eps,
                }
            )

    cast_list: List[Dict[str, Any]] = []
    raw_cast = [p for p in (info.cast or []) if hasattr(p, "name")][:8] if info else []
    if raw_cast:
        def _load_person(person_obj: Any) -> Dict[str, Any]:
            photo = getattr(person_obj, "img_url", None)
            if not photo and hasattr(person_obj, "quick_content"):
                try:
                    ext = person_obj.quick_content()
                    photo = getattr(ext, "img_url", None)
                except Exception:
                    photo = None
            return {
                "id": getattr(person_obj, "id", 0) or 0,
                "name": person_obj.name,
                "role": getattr(person_obj, "job", None) or "Актёр",
                "profilePath": _normalize_image_url(photo),
            }

        with ThreadPoolExecutor(max_workers=4) as pool:
            cast_list = list(pool.map(_load_person, raw_cast))

    if getattr(details, "url", None):
        _URL_BY_ID[f"rezka-{details.id}"] = details.url

    return {
        "id": f"rezka-{details.id}",
        "rezkaId": details.id,
        "rezkaUrl": details.url,
        "title": details.title,
        "originalTitle": details.original_title or details.title,
        "description": details.description or "",
        "posterUrl": _normalize_image_url(details.img_url),
        "backdropUrl": _normalize_image_url(details.img_url),
        "releaseYear": release_year,
        "rating": rating_val,
        "voteCount": votes_val,
        "genres": genres,
        "countries": countries,
        "duration": info.duration if info else None,
        "quality": info.quality if info else None,
        "status": details.status,
        "type": media_type,
        "source": "hdrezka",
        "cast": cast_list,
        "translators": translators,
        "seasons": seasons,
        "hasPlayer": isinstance(player, (Film, Serial)),
    }


def get_details(url: str = "", item_id: Optional[str] = None, force_refresh: bool = False) -> Dict[str, Any]:
    clean_url = (url or "").strip()
    if not clean_url and item_id:
        clean_url = _URL_BY_ID.get(item_id.strip(), "")
    if not clean_url:
        raise HdRezkaServiceError("BAD_REQUEST", "Не указан URL страницы HDRezka", status=400)

    cache_key = f"details:{clean_url}"
    if not force_refresh:
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    try:
        details, _ = _with_mirrors(lambda client, mirror: client.get(_rewrite_url_domain(clean_url, mirror)))
    except PageNotFound:
        raise HdRezkaServiceError("NOT_FOUND", "Контент не найден на HDRezka", status=404)

    payload = _extract_details_payload(details)
    return _cache_set(cache_key, payload, DETAILS_TTL)


def _score_candidate(poster: Any, title: str, original_title: Optional[str], year: Optional[int], media_type: Optional[str]) -> float:
    score = 0.0
    p_title = (poster.title or "").lower().strip()
    target = (title or "").lower().strip()
    orig = (original_title or "").lower().strip()

    if p_title == target or (orig and p_title == orig):
        score += 100.0
    elif target and target in p_title:
        score += 60.0
    elif orig and orig in p_title:
        score += 50.0

    p_year = _extract_year(poster.year)
    if year and p_year:
        diff = abs(p_year - int(year))
        if diff == 0:
            score += 40.0
        elif diff == 1:
            score += 15.0
        else:
            score -= min(diff * 5.0, 30.0)

    p_type = _infer_media_type(poster.entity, poster.status, poster.url)
    if media_type and p_type == media_type:
        score += 30.0
    elif media_type and p_type != media_type:
        score -= 25.0

    return score


def _find_best_url(title: str, original_title: Optional[str], year: Optional[int], media_type: Optional[str]) -> str:
    queries = [q.strip() for q in (title, original_title) if q and q.strip()]
    best_poster = None
    best_score = -999.0

    for q in queries:
        try:
            posters, _ = _with_mirrors(lambda client, _: client.search(q).page(1).get())
        except EmptyPage:
            continue
        for poster in posters[:10]:
            s = _score_candidate(poster, title, original_title, year, media_type)
            if s > best_score:
                best_score = s
                best_poster = poster
        if best_score >= 120.0:
            break

    if not best_poster:
        raise HdRezkaServiceError("NOT_FOUND", f"Не удалось найти «{title}» на HDRezka", status=404)
    return best_poster.url


def _build_streams_for_player(
    rezka_id: int,
    title: str,
    player: Union[Film, Serial],
    translator: Any,
    season: Optional[int],
    episode: Optional[int],
) -> Dict[str, Any]:
    url_dict = player.get_video_url() or {}
    subtitles_raw = player.get_subtitle_url() or []

    subtitles = [
        {
            "id": f"rezka-sub-{rezka_id}-{translator.id}-{idx}",
            "language": sub.code_lang or "ru",
            "label": sub.lang,
            "url": sub.url,
            "format": "vtt",
        }
        for idx, sub in enumerate(subtitles_raw)
        if getattr(sub, "url", None)
    ]

    streams: List[Dict[str, Any]] = []
    sorted_qualities = sorted(
        url_dict.keys(),
        key=lambda q: QUALITY_ORDER.get(q, 0),
        reverse=True,
    )

    for raw_quality in sorted_qualities:
        urls = url_dict.get(raw_quality) or []
        if not urls:
            continue
        mapped_quality = QUALITY_MAP.get(raw_quality, "720p")
        stream_url = urls[0]
        streams.append(
            {
                "id": f"rezka-{rezka_id}-{translator.id}-{raw_quality}".replace(" ", "-"),
                "providerId": "hdrezka",
                "providerName": "HDRezka",
                "title": f"{title} ({raw_quality})",
                "voiceActing": translator.full_title,
                "season": season,
                "episode": episode,
                "quality": mapped_quality,
                "qualityLabel": raw_quality,
                "format": "hls" if ".m3u8" in stream_url else "mp4",
                "streamUrl": stream_url,
                "isProxyRequired": True,
                "subtitles": subtitles,
            }
        )

    return {
        "providerId": "hdrezka",
        "providerName": "HDRezka",
        "voiceActing": translator.full_title,
        "translatorId": translator.id,
        "streams": streams,
    }


def _fetch_translator_group(
    target_url: str,
    mirror: str,
    translator: Any,
    season: Optional[int],
    episode: Optional[int],
    title: str,
) -> Optional[Dict[str, Any]]:
    try:
        client = HDrezka(mirror=mirror)
        details = client.get(_rewrite_url_domain(target_url, mirror))
        player = details.player
        if not isinstance(player, (Film, Serial)):
            return None

        if isinstance(player, Film):
            player.set_translate(translator.id, is_director=bool(translator.is_director))
        else:
            player.set_translate(translator.id)
            if season is not None:
                player.set_season(season_id=int(season))
                if episode is not None:
                    current_ep = player.get_current_episode()
                    if not current_ep or current_ep.id != int(episode):
                        player.set_episode(episode_id=int(episode))
        group = _build_streams_for_player(details.id, details.title, player, translator, season, episode)
        return group if group["streams"] else None
    except Exception:
        return None


def get_streams(
    url: Optional[str] = None,
    title: Optional[str] = None,
    original_title: Optional[str] = None,
    year: Optional[int] = None,
    media_type: Optional[str] = None,
    season: Optional[int] = None,
    episode: Optional[int] = None,
    translator_id: Optional[int] = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    target_url = (url or "").strip()
    if not target_url:
        if not title:
            raise HdRezkaServiceError("BAD_REQUEST", "Укажите url или title для поиска", status=400)
        target_url = _find_best_url(title, original_title, year, media_type)

    cache_key = f"streams:{target_url}:{season}:{episode}:{translator_id}"
    if not force_refresh:
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    try:
        details, mirror = _with_mirrors(lambda client, m: client.get(_rewrite_url_domain(target_url, m)))
    except PageNotFound:
        raise HdRezkaServiceError("NOT_FOUND", "Страница не найдена на HDRezka", status=404)

    player = details.player
    if not isinstance(player, (Film, Serial)):
        raise HdRezkaServiceError(
            "UNAVAILABLE",
            "Видео временно недоступно на HDRezka (возможно, доступен только трейлер)",
            status=404,
        )

    is_serial = isinstance(player, Serial)
    active_season = season
    active_episode = episode

    try:
        if translator_id is not None:
            if isinstance(player, Film):
                player.set_translate(int(translator_id))
            else:
                player.set_translate(int(translator_id))

        if is_serial:
            seasons_tabs = player.seasons_tabs or []
            if not seasons_tabs:
                raise HdRezkaServiceError("UNAVAILABLE", "У сериала отсутствуют доступные серии", status=404)
            target_season = int(season) if season is not None else seasons_tabs[0].id
            if player.get_current_season().id != target_season:
                player.set_season(season_id=target_season)
            target_ep = int(episode) if episode is not None else player.get_current_season().episodes[0].id
            if player.get_current_episode().id != target_ep:
                player.set_episode(episode_id=target_ep)
            active_season = target_season
            active_episode = target_ep
    except (ValueError, IndexError, AJAXFail) as err:
        raise HdRezkaServiceError("UNAVAILABLE", f"Серия или озвучка недоступна: {err}", status=404)

    current_tr = player.get_current_translate()
    primary_group = _build_streams_for_player(
        details.id,
        details.title,
        player,
        current_tr,
        active_season,
        active_episode,
    )

    source_groups: List[Dict[str, Any]] = []
    if primary_group["streams"]:
        source_groups.append(primary_group)

    # Fetch up to 3 additional non-premium translations in parallel so users can switch voiceovers
    other_translators = [
        tr
        for tr in (player.translate_list or [])
        if tr.id != current_tr.id and not tr.premium
    ][:3]

    if other_translators:
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = [
                pool.submit(
                    _fetch_translator_group,
                    target_url,
                    mirror,
                    tr,
                    active_season,
                    active_episode,
                    details.title,
                )
                for tr in other_translators
            ]
            for fut in as_completed(futures):
                grp = fut.result()
                if grp:
                    source_groups.append(grp)

    if not source_groups:
        raise HdRezkaServiceError("UNAVAILABLE", "Не найдено рабочих видеопотоков HDRezka", status=404)

    details_payload = _extract_details_payload(details)
    result = {
        "sourceGroups": source_groups,
        "media": details_payload,
        "activeSeason": active_season,
        "activeEpisode": active_episode,
        "activeTranslatorId": current_tr.id,
    }
    return _cache_set(cache_key, result, STREAM_TTL)
