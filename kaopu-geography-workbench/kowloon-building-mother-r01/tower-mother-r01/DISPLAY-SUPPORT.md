# Tower display boundary

This adapter does not add Mother generation rules or per-instance geometry data.
It reuses the R05 semantic palette, analytic rail trace and solid section caps,
R05 exact prism visibility, and shared bounds-scaled studio lighting functions.
No previous workbench source is changed by this display adapter.

- Primary round members: floor-local groups of at most64 capsules, exact original
  object IDs retained. The legacy per-group64 limit is not exceeded or truncated.
- Shadows: group AABB rejection followed by exact finite-cylinder and spherical
  end intersections. AABB is acceleration only, not a substitute shadow shape.
- Explicit budgets:512 finite polygon prisms;1024 round members;32 round groups.
  Exceeding a budget throws before replacing the previous usable model.
- Group bounds use a highp sampler; lower precision was found to mis-cull tall
  members near group boundaries and is specifically covered by numerical tests.
- Studio lights and gradient floor are normalized to whole-model bounds.
- Fully solid clip-plane sections preserve IDs and consistent shadow half-space.
- Current UI uses a whole model plus a clip plane, not arbitrary hidden-floor or
  custom display-archetype combinations. Those are not claimed validated here.
- No additional full-resolution framebuffer is introduced; descriptor textures
  are released on model replacement with the inherited texture lifecycle.

Tests:400 synthetic capsules across10 groups up to34.7m;1200 primary surface/ID/
bidirectional-cap rays and3200 clipped/unclipped shadow rays passed actual EGL
execution against CPU analytic references. Actual Tower setModel and palette
methods with mocked GL allocation passed five model/stage modes and140 toggles,
including8 layers at4.2m (449 prisms,596 round members,16 groups).
These are numerical/module checks, not full browser appearance, phone GPU speed,
structural certification or evidence that arbitrary modes outside this UI work.

Room R06 与 Tower 共用 Tower 目录的 bounds-aware StudioRenderer，棚地面随基础底部、双灯随整楼边界，避免新增深基础穿过旧固定棚底。构件颜色开关只改调色，不改几何。施工步骤保留完整楼体 bounds，镜头和灯不逐层跳变。
