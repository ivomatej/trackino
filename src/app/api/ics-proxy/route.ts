import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Chybí parametr url' }, { status: 400 });
  }

  // Ověř formát URL
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Neplatná URL adresa' }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/calendar, */*',
        'User-Agent': 'Trackino-Calendar/1.0',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Chyba při načítání kalendáře: ${response.status}` },
        { status: 502 }
      );
    }

    const text = await response.text();

    if (!text.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json(
        { error: 'URL neodkazuje na platný ICS/iCal soubor' },
        { status: 422 }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err) {
    console.error('[ics-proxy] Error:', err);
    return NextResponse.json(
      { error: 'Nepodařilo se načíst kalendář' },
      { status: 500 }
    );
  }
}
