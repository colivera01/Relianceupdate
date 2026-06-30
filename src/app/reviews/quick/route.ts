import { NextResponse } from "next/server";
import {
  saveQuickEmailReviewComment,
  submitQuickEmailReviewRating,
  type QuickEmailCommentResult,
  type QuickEmailReviewResult,
} from "@/lib/quick-email-review";

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageHtml(input: {
  title: string;
  eyebrow?: string;
  body: string;
  token?: string | null;
  showCommentForm?: boolean;
  rating?: number | null;
  vendorName?: string;
}): string {
  const token = String(input.token || "");
  const rating = Number(input.rating || 0);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)} | Reliance</title>
    <style>
      :root { color-scheme: dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background:
          linear-gradient(rgba(120, 170, 255, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(120, 170, 255, 0.035) 1px, transparent 1px),
          radial-gradient(circle at 80% 10%, rgba(34, 197, 94, 0.16), transparent 30%),
          radial-gradient(circle at 20% 0%, rgba(47, 109, 246, 0.18), transparent 34%),
          #050a12;
        background-size: 28px 28px, 28px 28px, auto, auto, auto;
        color: #eaf2ff;
        font-family: Arial, Helvetica, sans-serif;
      }
      main {
        width: min(100%, 620px);
        border: 1px solid #1d3b66;
        border-radius: 24px;
        background: rgba(8, 20, 38, 0.96);
        overflow: hidden;
        box-shadow: 0 24px 90px rgba(0, 0, 0, 0.45);
      }
      header { padding: 24px; border-bottom: 1px solid #18345d; background: #07111f; }
      img { width: 240px; max-width: 100%; height: auto; display: block; }
      section { padding: 28px 24px; }
      .eyebrow {
        margin: 14px 0 0;
        color: #7eb6ff;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        font-weight: 800;
        font-size: 12px;
      }
      h1 { margin: 0 0 14px; color: #fff; font-size: clamp(28px, 7vw, 44px); line-height: 1.05; }
      p { margin: 0 0 14px; color: #dce8ff; font-size: 17px; line-height: 1.55; }
      .note {
        margin-top: 20px;
        border: 1px solid #203f6c;
        border-radius: 16px;
        background: #0b1830;
        padding: 16px;
        color: #bfd0ea;
        font-size: 15px;
      }
      label { display: block; margin: 22px 0 8px; color: #fff; font-weight: 800; }
      textarea {
        width: 100%;
        min-height: 130px;
        resize: vertical;
        border-radius: 16px;
        border: 1px solid #2b5aa5;
        background: #07111f;
        color: #fff;
        padding: 14px;
        font: inherit;
      }
      .actions { display: grid; gap: 12px; margin-top: 16px; }
      button, a.button {
        border: 0;
        border-radius: 14px;
        background: #2f6df6;
        color: #fff;
        padding: 15px 18px;
        text-decoration: none;
        text-align: center;
        font-weight: 900;
        font-size: 16px;
      }
      a.secondary { color: #9ec5ff; text-align: center; text-decoration: none; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <img src="/reliance-email-logo.png" alt="Reliance" />
        ${input.eyebrow ? `<div class="eyebrow">${escapeHtml(input.eyebrow)}</div>` : ""}
      </header>
      <section>
        <h1>${escapeHtml(input.title)}</h1>
        ${input.body}
        ${
          input.showCommentForm && token && rating
            ? `<form method="post" action="/reviews/quick">
                <input type="hidden" name="token" value="${escapeHtml(token)}" />
                <label for="comment">Want to add a comment?</label>
                <textarea id="comment" name="comment" placeholder="Optional details about your service experience"></textarea>
                <div class="actions">
                  <button type="submit">Save Comment</button>
                  <a class="secondary" href="/reviews/quick?done=1">No thanks</a>
                </div>
              </form>`
            : ""
        }
      </section>
    </main>
  </body>
</html>`;
}

function response(html: string) {
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function bodyForRating(result: QuickEmailReviewResult): { title: string; body: string; showCommentForm?: boolean; rating?: number | null } {
  if (result.status === "created") {
    return {
      title: "Thank you. Your review was saved.",
      body: `
        <p>Your ${result.rating}-star review for ${escapeHtml(result.vendorName)} has been saved for admin moderation.</p>
        <div class="note">After Reliance approves the review, it can count toward the vendor's customer rating. The Reliance Trust Score stays separate.</div>
      `,
      showCommentForm: true,
      rating: result.rating,
    };
  }
  if (result.status === "already_submitted") {
    return {
      title: "Review already submitted.",
      body: `
        <p>A review is already on file for this service${result.rating ? ` with a ${result.rating}-star rating` : ""}.</p>
        <div class="note">For review integrity, each service can only receive one customer review from this secure email link.</div>
      `,
      showCommentForm: result.canAddComment,
      rating: result.rating,
    };
  }
  return {
    title: "Review link unavailable.",
    body: `<p>${escapeHtml(result.message)}</p>`,
  };
}

function bodyForComment(result: QuickEmailCommentResult): { title: string; body: string } {
  if (result.status === "saved") {
    return {
      title: "Comment saved.",
      body: `<p>Thank you. Your comment was added to your ${result.rating}-star review for ${escapeHtml(result.vendorName)}.</p>`,
    };
  }
  return {
    title: result.status === "already_submitted" ? "Comment already saved." : "Comment not saved.",
    body: `<p>${escapeHtml(result.message)}</p>`,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("done")) {
    return response(
      pageHtml({
        eyebrow: "Service feedback",
        title: "Thank you.",
        body: "<p>Your review has been saved. You can close this page.</p>",
      })
    );
  }
  const token = url.searchParams.get("token");
  const rating = url.searchParams.get("rating");
  const result = await submitQuickEmailReviewRating({ token, rating });
  const body = bodyForRating(result);
  return response(
    pageHtml({
      eyebrow: "Service feedback",
      token,
      ...body,
    })
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const result = await saveQuickEmailReviewComment({
    token: String(form.get("token") || ""),
    comment: form.get("comment"),
  });
  const body = bodyForComment(result);
  return response(
    pageHtml({
      eyebrow: "Service feedback",
      ...body,
    })
  );
}
