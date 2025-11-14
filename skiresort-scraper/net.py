# net.py
import time, random, sys, requests
from typing import Optional
from bs4 import BeautifulSoup

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; SkiResortResearchBot/0.3; +https://example.com/contact)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

def log(msg: str):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

def sleep_jitter(base_seconds: float = 1.0, jitter: float = 0.4):
    delay = base_seconds + random.uniform(0, jitter)
    time.sleep(delay)

def fetch(
    url: str,
    session: Optional[requests.Session] = None,
    max_retries: int = 3,
    backoff: float = 1.6,
    timeout: float = 30.0,
) -> requests.Response:
    """
    GET with simple retries + exponential backoff.
    Raises for non-2xx after final attempt.
    """
    s = session or requests.Session()
    s.headers.update(DEFAULT_HEADERS)

    attempt = 0
    while True:
        attempt += 1
        try:
            resp = s.get(url, timeout=timeout)
            if 200 <= resp.status_code < 300:
                return resp
            else:
                raise requests.HTTPError(f"HTTP {resp.status_code} for {url}")
        except Exception as e:
            if attempt >= max_retries:
                log(f"ERROR after {attempt} attempts: {e}")
                raise
            wait = (backoff ** (attempt - 1)) + random.uniform(0, 0.5)
            log(f"Retry {attempt}/{max_retries} after error: {e} | waiting {wait:.1f}s")
            time.sleep(wait)

def get_soup(
    url: str,
    session: Optional[requests.Session] = None,
    **fetch_kwargs,
) -> BeautifulSoup:
    resp = fetch(url, session=session, **fetch_kwargs)
    return BeautifulSoup(resp.text, "lxml")
