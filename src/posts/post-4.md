---
title: "Math test: the rendering equation, briefly"
date: 2026-07-13
category: shaders
emoji: ✨
math: true
description: A KaTeX-heavy mockup post used to test inline and block math rendering. Safe to delete.
---

> **Note to self:** mockup post to test KaTeX (inline + block, fractions, integrals, Greek,
> matrices). Delete before launch.

Almost everything a technical artist touches in lighting traces back to one equation. It
looks intimidating written out, but each piece has a plain-language job. Here it is.

## The equation

The outgoing radiance $L_o$ from a point $x$ in direction $\omega_o$ is the emitted light
plus everything reflected from the hemisphere $\Omega$ above the surface:

$$L_o(x, \omega_o) = L_e(x, \omega_o) + \int_{\Omega} f_r(x, \omega_i, \omega_o)\, L_i(x, \omega_i)\,(\omega_i \cdot n)\, d\omega_i$$

Reading it left to right: take the emitted light $L_e$, then add up — that's the integral
$\int_\Omega$ — the contribution of every incoming direction $\omega_i$, weighted by how the
surface reflects it and how grazing the angle is.

## The pieces

- $L_i(x, \omega_i)$ — the light *arriving* from direction $\omega_i$.
- $f_r(x, \omega_i, \omega_o)$ — the **BRDF**, the surface's rule for turning incoming light
  into outgoing light.
- $\omega_i \cdot n$ — the cosine term, $\cos\theta_i$. Light hitting head-on counts fully;
  light at a grazing angle barely counts at all.

That cosine is why a floor looks bright underfoot and dim toward the horizon.

## A concrete BRDF

For a simple diffuse surface with albedo $\rho$, the BRDF is just a constant:

$$f_r = \frac{\rho}{\pi}$$

The $\pi$ in the denominator is the part everyone forgets — it's what keeps energy conserved
so a surface never reflects more light than it receives.

Specular is where it gets interesting. The Fresnel term, using Schlick's approximation, is:

$$F(\theta) = F_0 + (1 - F_0)\,(1 - \cos\theta)^5$$

where $F_0$ is the reflectance at normal incidence. For most dielectrics $F_0 \approx 0.04$,
which is why even matte plastic gets a bright rim at grazing angles.

## Why the integral is hard

We can't evaluate $\int_\Omega$ exactly in real time, so we approximate it. Monte Carlo
integration samples $N$ random directions and averages:

$$\int_{\Omega} f(\omega)\, d\omega \approx \frac{1}{N} \sum_{k=1}^{N} \frac{f(\omega_k)}{p(\omega_k)}$$

The $p(\omega_k)$ is the probability of picking each sample — importance sampling just means
choosing $p$ to match where $f$ is large, so you spend samples where they matter.

## A tiny bit of linear algebra

Transforming a normal isn't the same as transforming a position. If $M$ is your model
matrix, normals must use the inverse-transpose:

$$n' = (M^{-1})^{\mathsf{T}}\, n$$

For a rotation like

$$R = \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix}$$

the inverse-transpose equals $R$ itself, which is why pure rotations never distort your
normals — but non-uniform scale does, and that is the usual culprit behind broken lighting.

## Wrapping up

You rarely type these equations into a shader directly, but knowing what each term *does*
turns "the lighting looks wrong" into a diagnosis. The cosine, the $\pi$, the Fresnel rim —
each one is a knob with a physical meaning.

If the math above rendered as crisp symbols rather than raw dollar signs, KaTeX is working.
