<script>
    let { children } = $props();
</script>

<div class="container-lg">
    <div class="row">
        <div class="col-sm-2"></div>
        <div class="col-sm-8 entry-content">
            {@render children()}
        </div>
    </div>
</div>