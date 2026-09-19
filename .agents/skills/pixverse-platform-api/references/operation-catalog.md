# Platform Operation Catalog

Every documented Platform API endpoint currently covered by `pixverse-api platform`.

| Marker | Command | Method | Path | Billing | Async |
|---|---|---:|---|---|---:|
| operation:account.balance | `platform account balance` | GET | `/openapi/v2/account/balance` | read-only | no |
| operation:account.usage | `platform account usage` | POST | `/openapi/v2/account/billing/usage-detail` | read-only | no |
| operation:upload.image | `platform upload image` | POST | `/openapi/v2/image/upload` | non-billable | no |
| operation:upload.media | `platform upload media` | POST | `/openapi/v2/media/upload` | non-billable | no |
| operation:resource.templates | `platform resource templates` | GET | `/openapi/v2/video/effects/templates/list` | read-only | no |
| operation:resource.tts-speakers | `platform resource tts-speakers` | GET | `/openapi/v2/video/tts_speaker` | read-only | no |
| operation:resource.restyle-effects | `platform resource restyle-effects` | GET | `/openapi/v2/video/restyle/list` | read-only | no |
| operation:voice.create | `platform voice create` | POST | `/openapi/v2/video/tts_speaker` | non-billable | no |
| operation:voice.delete | `platform voice delete` | DELETE | `/openapi/v2/video/tts_speaker/{speaker_id}` | non-billable | no |
| operation:image.template | `platform image template` | POST | `/openapi/v2/image/template/generate` | billable | yes |
| operation:image.status | `platform image status` | GET | `/openapi/v2/image/result/{image_id}` | read-only | no |
| operation:video.text | `platform video text` | POST | `/openapi/v2/video/text/generate` | billable | yes |
| operation:video.image | `platform video image` | POST | `/openapi/v2/video/img/generate` | billable | yes |
| operation:video.template | `platform video template` | POST | `/openapi/v2/video/img/generate` | billable | yes |
| operation:video.transition | `platform video transition` | POST | `/openapi/v2/video/transition/generate` | billable | yes |
| operation:video.multi-transition | `platform video multi-transition` | POST | `/openapi/v2/video/multi_transition/generate` | billable | yes |
| operation:video.lip-sync | `platform video lip-sync` | POST | `/openapi/v2/video/lip_sync/generate` | billable | yes |
| operation:video.fusion | `platform video fusion` | POST | `/openapi/v2/video/fusion/generate` | billable | yes |
| operation:video.restyle | `platform video restyle` | POST | `/openapi/v2/video/restyle/generate` | billable | yes |
| operation:video.swap-mask | `platform video swap-mask` | POST | `/openapi/v2/video/mask/selection` | billable | no |
| operation:video.swap | `platform video swap` | POST | `/openapi/v2/video/swap/generate` | billable | yes |
| operation:video.sound-effect | `platform video sound-effect` | POST | `/openapi/v2/video/sound_effect/generate` | billable | yes |
| operation:video.extend | `platform video extend` | POST | `/openapi/v2/video/extend/generate` | billable | yes |
| operation:video.motion-control | `platform video motion-control` | POST | `/openapi/v2/video/mimic/generate` | billable | yes |
| operation:video.modify | `platform video modify` | POST | `/openapi/v2/video/modify/generate` | billable | yes |
| operation:video.upscale | `platform video upscale` | POST | `/openapi/v2/video/upscale/generate` | billable | yes |
| operation:video.avatar | `platform video avatar` | POST | `/openapi/v2/video/avatar/generate` | billable | yes |
| operation:agent.viral-recreation | `platform agent viral-recreation` | POST | `/openapi/v2/video/agent/generate` | billable | yes |
| operation:agent.real-estate | `platform agent real-estate` | POST | `/openapi/v2/video/agent/generate` | billable | yes |
| operation:video.status | `platform video status` | GET | `/openapi/v2/video/result/{video_id}` | read-only | no |
