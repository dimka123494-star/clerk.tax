#!/usr/bin/env python3
"""
clerk.tax — збірка статей блогу з адмінки (/admin).

Netlify запускає цей скрипт при кожному деплої (див. netlify.toml).
Він читає статті з content/blog/*.md (їх створює адмінка Decap CMS)
і генерує:
  • сторінку blog-<slug>.html для кожної опублікованої статті;
  • картки цих статей у /blog (на місці мітки <!--CMS:CARDS-->);
  • записи в sitemap.xml (мітка <!--CMS:URLS-->);
  • редиректи .html → чиста адреса в _redirects.

Старі статті, зроблені вручну (blog-*.html без .md), не чіпаються.
Скрипт змінює файли лише в копії, яку збирає Netlify, —
у репозиторії мітки залишаються, тож повторна збірка нічого не дублює.
"""
import glob
import html
import json
import os
import re
import sys
from datetime import date

import markdown
import yaml

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://clerk.tax"
ORG = "ТОВ «ФОРВАРД КАР ЮА»"
MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня",
          "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"]
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def path(*p):
    return os.path.join(ROOT, *p)


def read(p):
    with open(path(p), encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(path(p), "w", encoding="utf-8") as f:
        f.write(s)


def to_date(v):
    if isinstance(v, date):
        return v
    return date.fromisoformat(str(v)[:10])


def ua_date(d):
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def esc(s):
    return html.escape(str(s or "").strip(), quote=True)


def load_posts():
    posts = []
    for f in sorted(glob.glob(path("content", "blog", "*.md"))):
        raw = open(f, encoding="utf-8").read()
        m = re.match(r"^---\s*\n(.*?)\n---\s*\n?(.*)$", raw, re.S)
        if not m:
            sys.exit(f"ПОМИЛКА: {f} — немає блоку з полями (---)")
        meta = yaml.safe_load(m.group(1)) or {}
        meta["body"] = m.group(2)
        if meta.get("draft"):
            continue
        slug = str(meta.get("slug", "")).strip().lower()
        if not SLUG_RE.match(slug):
            sys.exit(f"ПОМИЛКА: {f} — адреса (slug) «{slug}» має містити лише латиницю, цифри й дефіси")
        meta["slug"] = slug
        meta["file"] = f"blog-{slug}.html"
        meta["url"] = f"{SITE}/blog-{slug}"
        meta["date"] = to_date(meta["date"])
        meta["updated"] = to_date(meta["updated"]) if meta.get("updated") else None
        for k in ("title", "description"):
            if not meta.get(k):
                sys.exit(f"ПОМИЛКА: {f} — не заповнене поле {k}")
        posts.append(meta)
    # унікальність адрес
    seen = {}
    for p in posts:
        if p["slug"] in seen:
            sys.exit(f"ПОМИЛКА: дві статті з однаковою адресою blog-{p['slug']}")
        seen[p["slug"]] = p
    posts.sort(key=lambda p: p["date"], reverse=True)
    return posts


def render_body(md_text):
    body = markdown.markdown(md_text, extensions=["tables", "sane_lists", "attr_list"])
    # цитата (>) у редакторі = виділений блок «callout» на сайті
    body = body.replace("<blockquote>", '<div class="callout">').replace("</blockquote>", "</div>")
    # таблиці прокручуються на телефоні
    body = re.sub(r"<table>(.*?)</table>", r'<div class="tbl-wrap"><table>\1</table></div>', body, flags=re.S)
    # зовнішні посилання відкриваються в новій вкладці
    body = re.sub(r'<a href="(https?://(?!clerk\.tax)[^"]+)"',
                  r'<a href="\1" target="_blank" rel="noopener"', body)
    return body


def faq_html(faq):
    items = "".join(
        f'<div class="faq-item"><button class="faq-q" onclick="toggleFaq(this)">{esc(x.get("q"))}'
        f'<span class="faq-arrow">▾</span></button><div class="faq-a">{esc(x.get("a"))}</div></div>'
        for x in faq)
    return ('      <h2>Часті запитання</h2>\n'
            f'      <div class="faq-grid one-col" style="margin-top:1.6rem">{items}</div>\n')


def sources_html(src):
    li = "".join(
        f'<li><a href="{esc(x.get("url"))}" target="_blank" rel="noopener">{esc(x.get("title") or x.get("url"))}</a></li>'
        for x in src if x.get("url"))
    return f'<h2>Джерела</h2>\n<ul class="sources">{li}</ul>\n' if li else ""


def related_html(post, posts):
    others = [p for p in posts if p["slug"] != post["slug"]][:2]
    cards = [
        f'<a class="rel-card" href="/blog-{p["slug"]}"><strong>{esc(p.get("h1") or p["title"])}</strong>'
        f'<span>{esc(p.get("excerpt") or p["description"])}</span></a>' for p in others]
    if len(cards) < 2:
        cards.append('<a class="rel-card" href="/blog-reyestratsiya-pdv"><strong>Реєстрація платником ПДВ: '
                     'коли обов\'язкова, а коли вигідна</strong><span>Поріг 1 млн грн, добровільна реєстрація '
                     'та ціна рішення.</span></a>')
    cards.append('<a class="rel-card" href="/blog"><strong>Усі статті</strong>'
                 '<span>Повний перелік публікацій блогу.</span></a>')
    return "".join(cards[:3])


def jsonld(post):
    h1 = post.get("h1") or post["title"]
    crumb = post.get("crumb") or h1
    blocks = [{
        "@context": "https://schema.org", "@type": "BlogPosting",
        "headline": h1, "description": post["description"], "url": post["url"],
        "datePublished": post["date"].isoformat(),
        "dateModified": (post["updated"] or post["date"]).isoformat(),
        "inLanguage": "uk-UA",
        "author": {"@type": "Organization", "name": ORG, "url": SITE},
        "publisher": {"@type": "Organization", "name": ORG, "@id": f"{SITE}/#business"},
        "mainEntityOfPage": {"@type": "WebPage", "@id": post["url"]},
    }, {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Головна", "item": f"{SITE}/"},
            {"@type": "ListItem", "position": 2, "name": "Блог", "item": f"{SITE}/blog"},
            {"@type": "ListItem", "position": 3, "name": crumb, "item": post["url"]},
        ],
    }]
    if post.get("image"):
        blocks[0]["image"] = SITE + post["image"] if post["image"].startswith("/") else post["image"]
    faq = [x for x in (post.get("faq") or []) if x.get("q") and x.get("a")]
    if faq:
        blocks.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": x["q"], "acceptedAnswer": {"@type": "Answer", "text": x["a"]}}
            for x in faq]})
    # "</" усередині JSON ламає тег <script>, тому екрануємо
    return "\n".join('<script type="application/ld+json">' +
                     json.dumps(b, ensure_ascii=False).replace("</", "<\\/") + "</script>" for b in blocks)


def build_post(post, posts, tpl):
    h1 = post.get("h1") or post["title"]
    meta = ua_date(post["date"])
    if post["updated"] and post["updated"] != post["date"]:
        meta += f" · оновлено {ua_date(post['updated'])}"
    meta += f" · {ORG}"
    body = render_body(post["body"])
    body += sources_html(post.get("sources") or [])
    faq = [x for x in (post.get("faq") or []) if x.get("q") and x.get("a")]
    if faq:
        body += faq_html(faq)
    image = post.get("image") or "/og-image.jpg"
    if image.startswith("/"):
        image = SITE + image
    out = tpl
    for k, v in {
        "JSONLD": jsonld(post),  # першим: всередині вже екрановано
        "TITLE": esc(post["title"]),
        "DESC": esc(post["description"]),
        "URL": post["url"],
        "OGIMAGE": esc(image),
        "CRUMB": esc(post.get("crumb") or h1),
        "META": meta,
        "H1": esc(h1),
        "LEAD": esc(post.get("lead") or post["description"]),
        "RELATED": related_html(post, posts),
        "BODY": body,  # останнім: текст статті може містити будь-що
    }.items():
        out = out.replace("{{" + k + "}}", v)
    write(post["file"], out)


def main():
    posts = load_posts()
    tpl = read("_templates/post.html")
    legacy = {os.path.basename(f) for f in glob.glob(path("blog-*.html"))}
    for p in posts:
        if p["file"] in legacy and "<!--generated-by-cms-->" not in read(p["file"]):
            sys.exit(f"ПОМИЛКА: адреса blog-{p['slug']} уже зайнята старою статтею — оберіть іншу")
    for p in posts:
        build_post(p, posts, tpl.replace("</head>", "<!--generated-by-cms-->\n</head>", 1))

    # /blog — картки та розмітка
    blog = read("blog.html")
    cards = "".join(
        f'<a class="blog-card" href="/blog-{p["slug"]}"><div class="blog-date">{ua_date(p["date"])}</div>'
        f'<h2>{esc(p.get("h1") or p["title"])}</h2><p>{esc(p.get("excerpt") or p["description"])}</p>'
        f'<span class="more">Читати статтю →</span></a>' for p in posts)
    ld = "".join(json.dumps({"@type": "BlogPosting", "headline": p.get("h1") or p["title"],
                             "description": p.get("excerpt") or p["description"], "url": p["url"]},
                            ensure_ascii=False).replace("</", "<\\/") + ", " for p in posts)
    blog = blog.replace("<!--CMS:CARDS-->", cards).replace("/*CMS:LD*/", ld)
    write("blog.html", blog)

    # sitemap
    sm = read("sitemap.xml")
    urls = "".join(
        f'  <url><loc>{p["url"]}</loc><lastmod>{(p["updated"] or p["date"]).isoformat()}</lastmod>'
        f'<changefreq>monthly</changefreq><priority>0.7</priority></url>\n' for p in posts)
    write("sitemap.xml", sm.replace("<!--CMS:URLS-->\n", urls).replace("<!--CMS:URLS-->", urls))

    # редиректи .html → чиста адреса
    rd = read("_redirects")
    extra = "".join(f'\n/blog-{p["slug"]}.html  /blog-{p["slug"]}  301!' for p in posts
                    if f'/blog-{p["slug"]}.html ' not in rd)
    if extra:
        write("_redirects", rd.rstrip("\n") + "\n\n# --- Статті з адмінки (генерується build.py) ---" + extra + "\n")

    print(f"Готово: зібрано статей з адмінки — {len(posts)}")
    for p in posts:
        print(f"  • {p['url']}")


if __name__ == "__main__":
    main()
