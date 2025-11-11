<!--
  @component
  Renders US states using D3 geo projection
-->
<script>
    import { getContext } from 'svelte';
    import { geoPath } from 'd3-geo';
    
    const { data, width, height } = getContext('LayerCake');
    
    export let projection;
    export let stroke = '#e0e0e0';
    export let strokeWidth = 1;
    export let fill = '#f8f9fa';
    
    $: projectionFn = projection().fitSize([$width, $height], $data);
    $: pathGenerator = geoPath(projectionFn);
  </script>
  
  <g class="map-layer">
    {#each $data.features as feature}
      <path
        d={pathGenerator(feature)}
        fill={fill}
        stroke={stroke}
        stroke-width={strokeWidth}
        class="state-path"
      />
    {/each}
  </g>
  
  <style>
    .state-path {
      transition: fill 0.2s ease;
    }
    
    .state-path:hover {
      fill: #f0f0f0;
    }
  </style>