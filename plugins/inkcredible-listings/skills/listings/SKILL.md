---
name: inkcredible-listings
description: Draft, review, publish, update, and remove Inkcredible Pens storefront listings through the private MCP server.
---

# Inkcredible Listings

Use the Inkcredible Listings MCP tools for storefront catalog work.

## Required workflow

1. Start with `search_listings` when the user may be referring to an existing product.
2. For a new product, inspect the supplied photo and draft concise customer-facing copy.
3. Ask for any missing price or category. Valid categories are Pens, Stickers, Car Freshies, Canvas, and Custom.
4. Call `create_listing_draft`. Attach the product image with `upload_listing_photo` when image data is available.
5. Show the user the complete proposed title, price, category, tagline, description, and photo state.
6. Do not call `publish_listing` until the user explicitly confirms that final summary.
7. Treat live updates and deletion the same way: show the exact change and obtain explicit confirmation first.
8. Use `replace_live_listing_photo` for a missing or incorrect live product image, only after the user confirms the exact listing and replacement photo.
9. Use `preview_listing_draft` before publishing so the user can see the photo URL and readiness checks.
10. Treat a missing inventory quantity as made to order. Use exact quantities only when the user wants stock tracked, and confirm before setting a listing to zero.
11. Model sizes and other choices with `optionGroups`; keep names simple (for example, Size) and explain any price adjustments in the final preview.
12. Offer to remove abandoned drafts with `delete_listing_draft` or `cleanup_old_listing_drafts`, but never delete them without explicit confirmation.

Drafts are private to the signed-in account. Publishing makes the product immediately visible on the storefront.
