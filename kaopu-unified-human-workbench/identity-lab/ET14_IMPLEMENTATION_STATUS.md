# ET14 Implementation Status

## Added in this pass

### Wrinkle evolution

Added layered wrinkle model:

- structural wrinkles
- compression wrinkles
- micro wrinkles

The previous single groove concept is deprecated as a design direction.

### Lesion evolution

Added identity categories:

- freckles clusters
- acne stages
- pigment variation
- scar age profiles

### Automatic identity assignment

Added:

- skin personality selection
- body/context conditioned material bias
- 36 character assignment foundation

## Remaining integration work

Need to connect:

- ET14 wrinkle response into ET13 shader
- ET14 lesion fields into ET13 skin texture pipeline
- generate final 36 character profiles
- browser visual validation
- compare before/after renders

No mobile validation planned in this phase.

## Constraint

ET14 remains an extension layer.

Native face controls, ET13 identity parameters and existing archives remain the source of truth.
