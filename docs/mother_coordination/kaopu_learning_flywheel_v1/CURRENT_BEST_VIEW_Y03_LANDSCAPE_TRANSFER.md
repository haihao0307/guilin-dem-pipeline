# Current Best View — Landscape transfer Y03

Status: **Candidate partial**

The current Landscape candidate has two useful safety observations: exact protected anchors remain fixed and the recorded integrated run has zero triangle flips. Bandwidth filtering and a per-vertex displacement cap are therefore retained as a reversible candidate method.

They are not a sufficient transfer contract. PR #79 head `21861af63591d42bb84b9a88e00ef645ffc55b76` still contains the non-periodic `2.3` angular harmonic, clips `199,324 / 310,074` vertices (`64.28%`), and records no mean or derivative metric. The old R1 executable replay gives concrete control-dependent nonzero vertex means and non-monotone derivative proxies. Periodic-seam closure is therefore **Rejected** at the actual integrated head; mean neutrality is a **Candidate fail**; derivative acceptance, field fidelity after clipping, visual acceptance and collision/field coupling remain **Unknown**.

Production Mother branches, Canonical Truth and Frozen R1 remain **Frozen / unchanged**.

