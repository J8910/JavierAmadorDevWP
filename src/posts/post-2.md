---
title: A tiny shader for wind
date: 2026-06-24
category: shaders
emoji: 🌬️
math: true
description: A minimal vertex shader that adds believable wind to foliage without much setup.
---

Wind is one of those effects that sells a scene instantly. Here's the smallest version
I keep reaching for.

## The idea

Offset each vertex by a sine wave, scaled by how high up the vertex sits — so the trunk
stays put and the tips move most.

```glsl
float sway = sin(time + worldPos.x) * heightMask;
position.xz += sway * strength;
```

Written out, the horizontal offset for a vertex is $o = A \sin(\omega t + \phi)\, m_h$,
where $m_h$ is the height mask and $A$, $\omega$, $\phi$ are amplitude, frequency and phase:

$$o = A \sin(\omega t + \phi)\, m_h$$

Add a second wave at a different frequency and you get something that reads as natural
motion rather than a metronome.
