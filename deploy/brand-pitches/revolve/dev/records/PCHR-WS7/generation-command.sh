npx pixverse@latest --workspace-id "$PIXVERSE_WORKSPACE_ID" create reference \
  --images \
    ./inputs/storyboard.png \
    ./inputs/product-1.jpg \
    ./inputs/product-2.jpg \
    ./inputs/product-3.jpg \
    ./inputs/product-4.jpg \
    ./inputs/product-5.jpg \
    ./inputs/product-6.jpg \
    ./inputs/product-7.jpg \
  --audios ./inputs/music-master.mp3 \
  --prompt ./prompts/video-prompt.txt \
  --model minimax-h3 \
  --quality 1440p \
  --duration 10 \
  --aspect-ratio 9:16 \
  --idempotency-key "$PRODUCT_ID-minimax-h3-v1" \
  --no-wait --json
