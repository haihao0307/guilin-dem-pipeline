/** Shared lifecycle contract; each workbench ships this small identical helper.
 * An operation owns its page generation, never a later BFCache restoration. */
export class LifeEpoch {
  constructor(){this.active=true;this.value=0;}
  begin(){if(!this.active)throw new DOMException('Page inactive','AbortError');return ++this.value;}
  owns(ticket){return this.active&&ticket===this.value;}
  hide(){this.active=false;this.value++;}
  show(){this.active=true;}
}
